import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

const AG = Animated.createAnimatedComponent(G);
const AEllipse = Animated.createAnimatedComponent(Ellipse);
const AText = Animated.createAnimatedComponent(SvgText);
const APath = Animated.createAnimatedComponent(Path);

// Сцена
const VB_W = 220;
const VB_H = 290;
const CW = 152;
const CH = Math.round((CW * VB_H) / VB_W); // ~200
const STAGE_H = CH;
const HIDE = CH + 28;

// Анатомия (в координатах viewBox)
const CENTER_X = 110;
const SHOULDER_L = { x: 52, y: 196 };
const SHOULDER_R = { x: 168, y: 196 };
const HIP_L = { x: 96, y: 262 };
const HIP_R = { x: 124, y: 262 };
const EYE_L = { x: 88, y: 172 };
const EYE_R = { x: 132, y: 172 };
const ANT_BASE = { x: 110, y: 120 };

const ARM_BASE_L = 12; // покой: чуть в стороны
const ARM_BASE_R = -12;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Tearz — векторный риг-маскот. Каждая деталь анимируется отдельно и непрерывно
 * (дыхание, моргание, инерция антенны, взмахи рук/ног), а действия плавно
 * перетекают: ходьба, прыжок, кувырок, сон, привет, выглядывание из-под строки.
 */
type Props = {
  /** Композер в фокусе/печатает — Тирз прячется и выглядывает сбоку. */
  focused?: boolean;
};

function TirzikHeroBase({ focused }: Props) {
  const [innerW, setInnerW] = useState(0);
  const innerWRef = useRef(0);
  const focusedRef = useRef(false);
  const runningRef = useRef<Animated.CompositeAnimation | null>(null);

  // постоянные осцилляторы «жизни»
  const tBreath = useRef(new Animated.Value(0)).current;
  const tSway = useRef(new Animated.Value(0)).current;
  const tArm = useRef(new Animated.Value(0)).current;
  const walkPhase = useRef(new Animated.Value(0)).current;
  const wavePhase = useRef(new Animated.Value(0)).current;

  // драйверы действий
  const posX = useRef(new Animated.Value(0)).current; // контейнер, native
  const hideY = useRef(new Animated.Value(HIDE)).current; // контейнер, native
  const faceDir = useRef(new Animated.Value(1)).current; // контейнер, native
  const jumpY = useRef(new Animated.Value(0)).current; // svg
  const rootRot = useRef(new Animated.Value(0)).current;
  const sclXA = useRef(new Animated.Value(1)).current;
  const sclYA = useRef(new Animated.Value(1)).current;
  const walkAmt = useRef(new Animated.Value(0)).current;
  const waveAmt = useRef(new Animated.Value(0)).current;
  const sleepAmt = useRef(new Animated.Value(0)).current;
  const tuck = useRef(new Animated.Value(0)).current;
  const legBend = useRef(new Animated.Value(0)).current;
  const cheer = useRef(new Animated.Value(0)).current;
  const mouthOpen = useRef(new Animated.Value(0)).current;
  const eyeOpen = useRef(new Animated.Value(1)).current;
  const lookX = useRef(new Animated.Value(0)).current;
  const lookY = useRef(new Animated.Value(0)).current;
  const zOp = useRef(new Animated.Value(0)).current;
  const zY = useRef(new Animated.Value(0)).current;
  const ONE = useRef(new Animated.Value(1)).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w && w !== innerWRef.current) {
      innerWRef.current = w;
      setInnerW(w);
    }
  };

  // реакция на фокус композера: прерываем текущее действие, чтобы цикл сразу среагировал
  useEffect(() => {
    focusedRef.current = !!focused;
    runningRef.current?.stop();
  }, [focused]);

  useEffect(() => {
    if (!innerW) return;
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let curX = (innerW - CW) / 2;

    const tim = (
      v: Animated.Value,
      to: number,
      dur: number,
      ease: (n: number) => number = Easing.linear,
      native = false,
    ) => Animated.timing(v, { toValue: to, duration: dur, easing: ease, useNativeDriver: native });
    const spr = (v: Animated.Value, to: number, friction = 6, native = false) =>
      Animated.spring(v, { toValue: to, friction, tension: 70, useNativeDriver: native });
    const wait = (ms: number) =>
      new Promise<void>((res) => {
        const id = setTimeout(res, ms);
        timers.push(id);
      });
    const play = (a: Animated.CompositeAnimation) =>
      new Promise<void>((res) => {
        runningRef.current = a;
        a.start(() => res());
      });
    // прерываемое ожидание — чтобы Тирз реагировал на ввод почти мгновенно
    const idleWait = async (ms: number) => {
      const end = Date.now() + ms;
      while (alive && Date.now() < end) {
        if (focusedRef.current) return;
        await wait(150);
      }
    };
    const yoyo = (v: Animated.Value, dur: number) =>
      Animated.loop(
        Animated.sequence([
          tim(v, 1, dur, Easing.inOut(Easing.sin)),
          tim(v, 0, dur, Easing.inOut(Easing.sin)),
        ]),
      );

    // постоянная «жизнь»
    posX.setValue(curX);
    const lifeLoops = [yoyo(tBreath, 2100), yoyo(tSway, 2600), yoyo(tArm, 2400)];
    lifeLoops.forEach((l) => l.start());

    // моргание
    const scheduleBlink = () => {
      if (!alive) return;
      const id = setTimeout(() => {
        Animated.sequence([tim(eyeOpen, 0.08, 80), tim(eyeOpen, 1, 120)]).start();
        scheduleBlink();
      }, rand(2400, 5200));
      timers.push(id);
    };
    // взгляд: спокойный, в основном прямо, редкие мягкие переводы и возврат в центр
    let glanceOut = false;
    const scheduleLook = () => {
      if (!alive) return;
      const id = setTimeout(() => {
        glanceOut = !glanceOut;
        const gx = glanceOut ? rand(-0.3, 0.3) : 0;
        const gy = glanceOut ? rand(-0.1, 0.22) : 0;
        Animated.parallel([
          tim(lookX, gx, 700, Easing.inOut(Easing.quad)),
          tim(lookY, gy, 700, Easing.inOut(Easing.quad)),
        ]).start();
        scheduleLook();
      }, rand(2600, 5400));
      timers.push(id);
    };
    scheduleBlink();
    scheduleLook();

    const faceTurn = (dir: number) => play(tim(faceDir, dir, 200, Easing.out(Easing.cubic), true));
    const setX = (x: number) => {
      curX = x;
      posX.setValue(x);
    };
    const rangeX = () => Math.max(0, innerWRef.current - CW);

    const emerge = async () => {
      await play(spr(hideY, 0, 7, true));
      await play(
        Animated.sequence([
          Animated.parallel([tim(sclYA, 0.86, 90), tim(sclXA, 1.12, 90)]),
          Animated.parallel([spr(sclYA, 1, 5), spr(sclXA, 1, 5)]),
        ]),
      );
    };
    const duck = () => play(tim(hideY, HIDE, 320, Easing.in(Easing.cubic), true));

    const peek = async () => {
      const x = rand(0, rangeX());
      setX(x);
      await play(spr(hideY, CH * 0.46, 7, true));
      await play(Animated.sequence([tim(rootRot, -5, 420), tim(rootRot, 6, 620), tim(rootRot, 0, 380)]));
      await wait(280);
      await play(tim(hideY, HIDE, 300, Easing.in(Easing.cubic), true));
    };

    const idle = async (ms: number) => {
      await wait(ms);
    };

    const wave = async () => {
      await play(tim(waveAmt, 1, 220, Easing.out(Easing.cubic)));
      const loop = yoyo(wavePhase, 300);
      loop.start();
      await play(tim(mouthOpen, 0.4, 200));
      await wait(1900);
      loop.stop();
      await play(Animated.parallel([tim(wavePhase, 0, 160), tim(mouthOpen, 0, 200), tim(waveAmt, 0, 240)]));
    };

    const walk = async () => {
      const dir = Math.random() < 0.5 ? 1 : -1;
      await faceTurn(dir);
      const maxX = rangeX();
      const target =
        dir > 0
          ? Math.min(maxX, curX + rand(maxX * 0.45, maxX * 0.85))
          : Math.max(0, curX - rand(maxX * 0.45, maxX * 0.85));
      const dist = Math.abs(target - curX);
      const dur = Math.max(700, (dist / Math.max(1, maxX)) * 1700);
      await play(tim(walkAmt, 1, 200));
      const loop = yoyo(walkPhase, 300);
      loop.start();
      await play(tim(posX, target, dur, Easing.inOut(Easing.quad), true));
      curX = target;
      loop.stop();
      await play(Animated.parallel([tim(walkPhase, 0, 150), tim(walkAmt, 0, 220)]));
    };

    const sleep = async () => {
      await play(Animated.sequence([tim(mouthOpen, 0.6, 380), tim(mouthOpen, 0, 320)])); // зевок
      await play(Animated.parallel([tim(sleepAmt, 1, 420), tim(rootRot, 7, 420)]));
      const zzz = Animated.loop(
        Animated.sequence([
          Animated.parallel([tim(zOp, 1, 500), tim(zY, -26, 1500, Easing.out(Easing.quad))]),
          tim(zOp, 0, 480),
          tim(zY, 0, 0),
        ]),
      );
      zzz.start();
      await wait(2200);
      zzz.stop();
      zOp.setValue(0);
      await play(Animated.parallel([tim(sleepAmt, 0, 420), tim(rootRot, 0, 380)]));
      await play(Animated.sequence([tim(eyeOpen, 0.1, 60), tim(eyeOpen, 1, 140)]));
    };

    // перелезает через строку: хват сверху → подтягивания рывками → закидывает себя наверх
    const climbUp = async () => {
      setX(rand(0, rangeX()));
      await play(tim(cheer, 1, 220, Easing.out(Easing.cubic)));
      await play(
        Animated.parallel([
          tim(hideY, CH * 0.52, 300, Easing.out(Easing.quad), true),
          tim(rootRot, -7, 300),
        ]),
      );
      await play(
        Animated.sequence([
          Animated.parallel([
            tim(hideY, CH * 0.32, 200, Easing.out(Easing.quad), true),
            tim(rootRot, 6, 200),
            tim(legBend, 0.85, 200),
          ]),
          Animated.parallel([
            tim(hideY, CH * 0.14, 190, Easing.out(Easing.quad), true),
            tim(rootRot, -4, 190),
            tim(legBend, 0.25, 190),
          ]),
          Animated.parallel([
            tim(hideY, 0, 220, Easing.out(Easing.quad), true),
            tim(rootRot, 0, 220),
            tim(legBend, 0, 220),
          ]),
        ]),
      );
      await play(
        Animated.parallel([
          tim(cheer, 0, 240),
          Animated.sequence([
            Animated.parallel([tim(sclYA, 0.86, 90), tim(sclXA, 1.12, 90)]),
            Animated.parallel([spr(sclYA, 1, 5), spr(sclXA, 1, 5)]),
          ]),
        ]),
      );
    };
    const climbDown = async () => {
      await play(tim(cheer, 1, 200));
      await play(
        Animated.sequence([
          Animated.parallel([tim(hideY, CH * 0.34, 220, Easing.in(Easing.quad), true), tim(rootRot, 7, 220)]),
          Animated.parallel([tim(hideY, HIDE, 300, Easing.in(Easing.cubic), true), tim(rootRot, 0, 300)]),
        ]),
      );
      await play(tim(cheer, 0, 180));
    };
    const climbCycle = async () => {
      await climbUp();
      await idle(rand(500, 900));
      await wave();
      await idle(rand(400, 700));
      await climbDown();
    };

    const surface = async (fn: () => Promise<void>) => {
      await emerge();
      await idle(rand(250, 600));
      await fn();
      await idle(rand(200, 500));
      await duck();
    };

    // печатаешь — Тирз уезжает к краю и выглядывает из-за строки, с любопытством смотрит
    const sidePeek = async () => {
      const right = Math.random() < 0.5;
      const x = right ? rangeX() : 0;
      await faceTurn(right ? -1 : 1);
      await play(
        Animated.parallel([
          tim(posX, x, 380, Easing.out(Easing.cubic), true),
          tim(hideY, CH * 0.5, 380, Easing.out(Easing.cubic), true),
          tim(rootRot, right ? 9 : -9, 380),
        ]),
      );
      curX = x;
      await play(
        Animated.sequence([
          tim(lookX, right ? -0.7 : 0.7, 520, Easing.inOut(Easing.quad)),
          tim(lookX, right ? -0.45 : 0.45, 520, Easing.inOut(Easing.quad)),
        ]),
      );
    };
    const returnCenter = async () => {
      const center = (innerWRef.current - CW) / 2;
      await play(
        Animated.parallel([
          tim(posX, center, 380, Easing.inOut(Easing.quad), true),
          tim(hideY, HIDE, 380, Easing.in(Easing.cubic), true),
          tim(rootRot, 0, 320),
          tim(lookX, 0, 320),
        ]),
      );
      curX = center;
    };

    const pool: (() => Promise<void>)[] = [
      () => peek(),
      () => peek(),
      () => surface(wave),
      () => surface(walk),
      () => surface(sleep),
      () => climbCycle(),
      () => surface(async () => { await walk(); await wave(); }),
    ];
    let last = -1;
    let parked = false;

    const loop = async () => {
      await wait(700);
      if (alive && !focusedRef.current) await peek();
      while (alive) {
        if (focusedRef.current) {
          if (!parked) {
            parked = true;
            await sidePeek();
          }
          await wait(220);
          continue;
        }
        if (parked) {
          parked = false;
          await returnCenter();
        }
        await idleWait(rand(2600, 5600));
        if (!alive || focusedRef.current) continue;
        let i = Math.floor(Math.random() * pool.length);
        if (i === last) i = (i + 1) % pool.length;
        last = i;
        await pool[i]();
      }
    };

    void loop();
    return () => {
      alive = false;
      runningRef.current?.stop();
      lifeLoops.forEach((l) => l.stop());
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [innerW]);

  // ── производные значения для частей тела ────────────────────────────────
  const v = useMemo(() => {
    const ip = (a: Animated.Value, out: number[], inp: number[] = [0, 1]) =>
      a.interpolate({ inputRange: inp, outputRange: out });
    const mul = Animated.multiply;
    const add = Animated.add;
    const sub = Animated.subtract;

    const openFactor = sub(ONE, sleepAmt);
    const armScale = sub(ONE, mul(tuck, 0.55));

    // антенна: качание + инерция орба + подскок при ходьбе
    const antAngle = add(ip(tSway, [-7, 7]), mul(walkAmt, ip(walkPhase, [-5, 5])));
    const orbLag = ip(tArm, [-4, 4]);

    // руки
    const idleArmL = ip(tArm, [ARM_BASE_L - 5, ARM_BASE_L + 5]);
    const idleArmR = ip(tArm, [ARM_BASE_R + 5, ARM_BASE_R - 5]);
    const walkArmL = mul(walkAmt, ip(walkPhase, [-22, 22]));
    const walkArmR = mul(walkAmt, ip(walkPhase, [22, -22]));
    const waveR = mul(waveAmt, ip(wavePhase, [-150 - ARM_BASE_R, -172 - ARM_BASE_R]));
    const cheerL = mul(cheer, 150 - ARM_BASE_L);
    const cheerR = mul(cheer, -150 - ARM_BASE_R);
    const tuckL = mul(tuck, 60);
    const tuckR = mul(tuck, -60);
    const armL = add(add(idleArmL, walkArmL), add(cheerL, tuckL));
    const armR = add(add(idleArmR, walkArmR), add(waveR, add(cheerR, tuckR)));

    // ноги
    const liftL = mul(add(legBend, tuck), 26);
    const liftR = mul(add(legBend, tuck), -26);
    const legL = add(mul(walkAmt, ip(walkPhase, [-24, 24])), liftL);
    const legR = add(mul(walkAmt, ip(walkPhase, [24, -24])), liftR);

    const walkBob = mul(walkAmt, ip(walkPhase, [-3.5, 3.5]));

    return {
      charY: add(jumpY, walkBob),
      rootRotDeg: add(rootRot, ip(tSway, [-1.4, 1.4])),
      sclXTot: mul(sclXA, ip(tBreath, [1.0, 1.014])),
      sclYTot: mul(sclYA, ip(tBreath, [1.0, 0.974])),
      eyeScaleY: mul(eyeOpen, openFactor),
      openFactor,
      lookGX: ip(lookX, [-2.6, 2.6]),
      lookGY: ip(lookY, [-1.6, 2.2]),
      mouthScaleY: mouthOpen,
      smileOpacity: sub(ONE, mouthOpen),
      antAngle,
      orbLag,
      armL,
      armR,
      armScale,
      legL,
      legR,
      shadowScale: ip(jumpY, [0.6, 1], [-54, 0]),
      shadowOpacity: ip(jumpY, [0.14, 0.34], [-54, 0]),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.zone} onLayout={onLayout} pointerEvents="none">
      <Animated.View
        style={[
          styles.box,
          { transform: [{ translateX: posX }, { translateY: hideY }, { scaleX: faceDir }] },
        ]}>
        <Svg width={CW} height={CH} viewBox={`0 0 ${VB_W} ${VB_H}`}>
          <Defs>
            {/* объёмное тело — свет сверху-слева, тёмный край снизу-справа */}
            <RadialGradient id="tzBody" cx="38%" cy="30%" r="82%">
              <Stop offset="0%" stopColor="#AEEBFF" />
              <Stop offset="36%" stopColor="#41A8FF" />
              <Stop offset="76%" stopColor="#1372E6" />
              <Stop offset="100%" stopColor="#0A53C2" />
            </RadialGradient>
            <RadialGradient id="tzFace" cx="42%" cy="36%" r="74%">
              <Stop offset="0%" stopColor="#FFFFFF" />
              <Stop offset="58%" stopColor="#E4F2FF" />
              <Stop offset="100%" stopColor="#B6D8FF" />
            </RadialGradient>
            <RadialGradient id="tzGloss" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.62} />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="tzAO" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#06296A" stopOpacity={0.4} />
              <Stop offset="100%" stopColor="#06296A" stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id="tzLimb" x1="0.1" y1="0" x2="0.9" y2="1">
              <Stop offset="0%" stopColor="#67CCFF" />
              <Stop offset="100%" stopColor="#1471DA" />
            </LinearGradient>
            <RadialGradient id="tzOrb" cx="50%" cy="36%" r="64%">
              <Stop offset="0%" stopColor="#FFFFFF" />
              <Stop offset="46%" stopColor="#9FECFF" />
              <Stop offset="100%" stopColor="#34B8FF" />
            </RadialGradient>
          </Defs>

          {/* тень на «полу» */}
          <AEllipse
            cx={CENTER_X}
            cy={284}
            rx={50}
            ry={9}
            fill="#000000"
            opacity={v.shadowOpacity}
            scaleX={v.shadowScale}
            originX={CENTER_X}
            originY={284}
          />

          {/* корень: подпрыг (translate) → поворот (центр) → squash (от пола) */}
          <AG y={v.charY}>
            <AG rotation={v.rootRotDeg} originX={CENTER_X} originY={200}>
              <AG scaleX={v.sclXTot} scaleY={v.sclYTot} originX={CENTER_X} originY={282}>
                {/* ноги */}
                <AG x={HIP_L.x} y={HIP_L.y}>
                  <AG rotation={v.legL} originX={0} originY={0}>
                    <Rect x={-10} y={0} width={20} height={20} rx={9} fill="url(#tzLimb)" />
                    <Ellipse cx={0} cy={22} rx={12} ry={7} fill="#54C9FF" />
                  </AG>
                </AG>
                <AG x={HIP_R.x} y={HIP_R.y}>
                  <AG rotation={v.legR} originX={0} originY={0}>
                    <Rect x={-10} y={0} width={20} height={20} rx={9} fill="url(#tzLimb)" />
                    <Ellipse cx={0} cy={22} rx={12} ry={7} fill="#54C9FF" />
                  </AG>
                </AG>

                {/* руки за телом */}
                <AG x={SHOULDER_L.x} y={SHOULDER_L.y}>
                  <AG rotation={v.armL} originX={0} originY={0}>
                    <AG scaleX={v.armScale} scaleY={v.armScale} originX={0} originY={0}>
                      <Rect x={-9} y={-4} width={18} height={56} rx={9} fill="url(#tzLimb)" />
                      <Circle cx={0} cy={52} r={11} fill="#62CBFF" />
                      <Circle cx={-3} cy={48} r={3} fill="#FFFFFF" opacity={0.5} />
                    </AG>
                  </AG>
                </AG>
                <AG x={SHOULDER_R.x} y={SHOULDER_R.y}>
                  <AG rotation={v.armR} originX={0} originY={0}>
                    <AG scaleX={v.armScale} scaleY={v.armScale} originX={0} originY={0}>
                      <Rect x={-9} y={-4} width={18} height={56} rx={9} fill="url(#tzLimb)" />
                      <Circle cx={0} cy={52} r={11} fill="#62CBFF" />
                      <Circle cx={-3} cy={48} r={3} fill="#FFFFFF" opacity={0.5} />
                    </AG>
                  </AG>
                </AG>

                {/* антенна */}
                <AG x={ANT_BASE.x} y={ANT_BASE.y}>
                  <AG rotation={v.antAngle} originX={0} originY={0}>
                    <Path d="M0 0 L0 -28" stroke="#2C97FF" strokeWidth={7} strokeLinecap="round" />
                    <AG rotation={v.orbLag} originX={0} originY={0}>
                      <Circle cx={0} cy={-34} r={10} fill="url(#tzOrb)" />
                    </AG>
                  </AG>
                </AG>

                {/* тело */}
                <Ellipse cx={CENTER_X} cy={200} rx={66} ry={82} fill="url(#tzBody)" />
                {/* мягкий объём снизу */}
                <Ellipse cx={CENTER_X} cy={248} rx={56} ry={42} fill="url(#tzAO)" />
                {/* мягкий глянец сверху-слева */}
                <Ellipse cx={84} cy={146} rx={30} ry={40} fill="url(#tzGloss)" />
                {/* лицо-визор */}
                <Ellipse cx={CENTER_X} cy={172} rx={50} ry={46} fill="url(#tzFace)" />

                {/* открытые глаза */}
                <AG opacity={v.openFactor}>
                  <AG scaleY={v.eyeScaleY} originX={EYE_L.x} originY={EYE_L.y}>
                    <Ellipse cx={EYE_L.x} cy={EYE_L.y} rx={11} ry={14} fill="#FFFFFF" />
                    <AG x={v.lookGX} y={v.lookGY}>
                      <Circle cx={EYE_L.x} cy={EYE_L.y + 2} r={5.6} fill="#0B2A4A" />
                      <Circle cx={EYE_L.x - 2} cy={EYE_L.y - 1} r={2.6} fill="#FFFFFF" />
                    </AG>
                  </AG>
                  <AG scaleY={v.eyeScaleY} originX={EYE_R.x} originY={EYE_R.y}>
                    <Ellipse cx={EYE_R.x} cy={EYE_R.y} rx={11} ry={14} fill="#FFFFFF" />
                    <AG x={v.lookGX} y={v.lookGY}>
                      <Circle cx={EYE_R.x} cy={EYE_R.y + 2} r={5.6} fill="#0B2A4A" />
                      <Circle cx={EYE_R.x - 2} cy={EYE_R.y - 1} r={2.6} fill="#FFFFFF" />
                    </AG>
                  </AG>
                </AG>
                {/* закрытые (сон) глаза */}
                <AG opacity={sleepAmt}>
                  <Path d={`M${EYE_L.x - 9} ${EYE_L.y} Q${EYE_L.x} ${EYE_L.y + 8} ${EYE_L.x + 9} ${EYE_L.y}`} stroke="#1B4E86" strokeWidth={3} fill="none" strokeLinecap="round" />
                  <Path d={`M${EYE_R.x - 9} ${EYE_R.y} Q${EYE_R.x} ${EYE_R.y + 8} ${EYE_R.x + 9} ${EYE_R.y}`} stroke="#1B4E86" strokeWidth={3} fill="none" strokeLinecap="round" />
                </AG>

                {/* рот */}
                <APath
                  d="M96 192 Q110 204 124 192"
                  stroke="#2A3B6B"
                  strokeWidth={4}
                  fill="none"
                  strokeLinecap="round"
                  opacity={v.smileOpacity}
                />
                <AG scaleY={v.mouthScaleY} originX={CENTER_X} originY={198}>
                  <Ellipse cx={CENTER_X} cy={198} rx={9} ry={7} fill="#3A1730" />
                </AG>
              </AG>
            </AG>
          </AG>

          {/* z-z-z */}
          <AG y={zY}>
            <AText x={156} y={120} fill="#64D2FF" fontSize={20} fontWeight="800" opacity={zOp}>
              z
            </AText>
          </AG>
        </Svg>
      </Animated.View>
    </View>
  );
}

export const TirzikHero = memo(TirzikHeroBase);

const styles = StyleSheet.create({
  zone: {
    height: STAGE_H,
    overflow: 'hidden',
  },
  box: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: CW,
    height: CH,
  },
});
