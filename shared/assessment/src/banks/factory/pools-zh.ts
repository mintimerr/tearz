import type { AssessmentSkill, CefrLevel } from '../../types.js';
import type { PoolItem } from './pools-en.js';
import { mergeZhHighPools } from './pools-zh-high.js';

/**
 * ZH pool v3 — independent Chinese situations; distractors model 了/过/着, 不/没,
 * measure words, word order, 把/被, register — never European calques or 门-glued junk.
 * C1/C2 come from pools-zh-high (Phase B.3).
 */
const ZH_POOLS_BASE: Record<AssessmentSkill, Partial<Record<CefrLevel, PoolItem[]>>> = {
  grammar: {
    A1: [
      {
        conceptKey: 'zh.a1.shi',
        stem: '我 ____ 学生。',
        prompt: '选择正确的形式。',
        options: ['是', '在', '有', '很'],
        correctIndex: 0,
        explanation: '身份用「是」。',
      },
      {
        conceptKey: 'zh.a1.measure',
        stem: '我要一 ____ 水。',
        prompt: '选择正确的形式。',
        options: ['杯', '个', '只', '条'],
        correctIndex: 0,
        explanation: '杯是水的量词。',
      },
    ],
    A2: [
      {
        conceptKey: 'zh.a2.le',
        stem: '昨天我看 ____ 一部电影。',
        prompt: '选择正确的形式。',
        options: ['了', '过', '着', '的'],
        correctIndex: 0,
        explanation: '完成的具体事件用「了」。',
      },
      {
        conceptKey: 'zh.a2.bu_mei',
        stem: '我昨天 ____ 去学校。',
        prompt: '选择正确的形式。',
        options: ['没', '不', '别', '未有'],
        correctIndex: 0,
        explanation: '过去否定用「没」。',
      },
    ],
    B1: [
      {
        conceptKey: 'zh.b1.guo',
        stem: '我以前来 ____ 北京。',
        prompt: '选择正确的形式。',
        options: ['过', '了', '着', '的'],
        correctIndex: 0,
        explanation: '经历体用「过」。',
      },
      {
        conceptKey: 'zh.b1.ba',
        stem: '请把窗户 ____ 。',
        prompt: '选择正确的形式。',
        options: ['打开', '开了开', '打开着', '打一打'],
        correctIndex: 0,
        explanation: '把字句：把 + 宾语 + 结果补语「打开」。',
      },
    ],
    B2: [
      {
        conceptKey: 'zh.b2.bei',
        stem: '我的车 ____ 修好了。',
        prompt: '选择正确的形式。',
        options: ['被', '把', '让', '叫'],
        correctIndex: 0,
        explanation: '被动用「被」。',
      },
      {
        conceptKey: 'zh.b2.complement',
        stem: '他说得太 ____ ，我没听清。',
        prompt: '选择正确的形式。',
        options: ['快', '快速', '快快', '快着'],
        correctIndex: 0,
        explanation: '程度补语：说得快。',
      },
    ],
  },
  vocabulary: {
    A1: [
      {
        conceptKey: 'zh.a1.vocab_zaofan',
        stem: '早上我吃 ____ 。',
        prompt: '选择最合适的词。',
        options: ['早饭', '午饭', '晚饭', '夜宵'],
        correctIndex: 0,
        explanation: '早饭。',
      },
      {
        conceptKey: 'zh.a1.vocab_umbrella',
        stem: '下雨了，带上 ____ 。',
        prompt: '选择最合适的词。',
        options: ['雨伞', '雨衣', '雨水', '雨点'],
        correctIndex: 0,
        explanation: '出门挡雨用雨伞。',
      },
    ],
    A2: [
      {
        conceptKey: 'zh.a2.vocab_appointment',
        stem: '我下午两点有 ____ 。',
        prompt: '选择最合适的词。',
        options: ['预约', '预言', '预报', '预制'],
        correctIndex: 0,
        explanation: '预约=appointment。',
      },
      {
        conceptKey: 'zh.a2.vocab_late',
        stem: '地铁停了，对不起我 ____ 了。',
        prompt: '选择最合适的词。',
        options: ['迟到', '早到', '到达', '离开'],
        correctIndex: 0,
        explanation: '迟到。',
      },
    ],
    B1: [
      {
        conceptKey: 'zh.b1.vocab_deadline',
        stem: '请在周五 ____ 前交表格。',
        prompt: '选择最合适的词。',
        options: ['截止', '总结', '标题', '提纲'],
        correctIndex: 0,
        explanation: '截止日期。',
      },
      {
        conceptKey: 'zh.b1.colloc_make_decision',
        stem: '我们今天必须 ____ 决定。',
        prompt: '选择最合适的词。',
        options: ['做出', '做到', '放到', '拿到'],
        correctIndex: 0,
        explanation: '做出决定。',
      },
    ],
    B2: [
      {
        conceptKey: 'zh.b2.near_raise',
        stem: '公司计划明年 ____ 工资。',
        prompt: '选择最合适的词。',
        options: ['提高', '上升', '升起', '抬起'],
        correctIndex: 0,
        explanation: '及物：提高工资。',
      },
      {
        conceptKey: 'zh.b2.colloc_traffic',
        stem: '环路上车辆很 ____ 。',
        prompt: '选择最合适的词。',
        options: ['拥堵', '强壮', '厚重', '严厉'],
        correctIndex: 0,
        explanation: '拥堵。',
      },
    ],
  },
  reading: {
    A1: [
      {
        conceptKey: 'zh.a1.read_hours',
        stem: '告示：「午餐休息 13:00–14:00 不营业。」什么时候可以买东西？',
        prompt: '选择最佳答案。',
        options: ['13:00前或14:00后', '只在13:00', '整个下午不停业', '今天不行'],
        correctIndex: 0,
        explanation: '仅休息时段不营业。',
      },
      {
        conceptKey: 'zh.a1.read_bus',
        stem: '站牌：「12路 → 火车站。」12路去哪里？',
        prompt: '选择最佳答案。',
        options: ['去火车站', '只去12路', '绕城不停', '哪也不去'],
        correctIndex: 0,
        explanation: '箭头指向终点。',
      },
    ],
    A2: [
      {
        conceptKey: 'zh.a2.read_wifi',
        stem: '卡片：「访客Wi‑Fi / 密码在小票上。」密码在哪？',
        prompt: '选择最佳答案。',
        options: ['在小票上', '在访客身上', '只在路由器上', '没有密码'],
        correctIndex: 0,
        explanation: '密码在小票。',
      },
      {
        conceptKey: 'zh.a2.read_number',
        stem: '提示：「取号后等候。」先做什么？',
        prompt: '选择最佳答案。',
        options: ['取号', '不取号直接等', '马上离开', '叫经理'],
        correctIndex: 0,
        explanation: '先取号。',
      },
    ],
    B1: [
      {
        conceptKey: 'zh.b1.read_refund',
        stem: '规定：「未使用的票可在购买后48小时内退款。」何时可退？',
        prompt: '选择最佳答案。',
        options: ['购买后两天内且未使用', '活动后任意时间', '仅购买前', '未使用也不可退'],
        correctIndex: 0,
        explanation: '48小时+未使用。',
      },
      {
        conceptKey: 'zh.b1.read_shift',
        stem: '聊天：「你周四替我，我周一替你，可以吗？」提出什么？',
        prompt: '选择最佳答案。',
        options: ['换班', '两人都放假', '辞职', '降薪'],
        correctIndex: 0,
        explanation: '换班。',
      },
    ],
    B2: [
      {
        conceptKey: 'zh.b2.read_hedged',
        stem: '简报：「增长很可能出现，尽管供应风险仍不可忽视。」作者态度？',
        prompt: '选择最佳答案。',
        options: ['乐观但有保留', '必然崩溃', '没有看法', '纯粹庆祝'],
        correctIndex: 0,
        explanation: '很可能+尽管=谨慎乐观。',
      },
      {
        conceptKey: 'zh.b2.read_soft_no',
        stem: '邮件：「我们欣赏这个构想；时间安排是障碍。」言外之意？',
        prompt: '选择最佳答案。',
        options: ['暂时婉拒', '立即批准', '要求付款', '毫无保留的称赞'],
        correctIndex: 0,
        explanation: '时间障碍=推迟/拒绝。',
      },
    ],
  },
  functional: {
    A1: [
      {
        conceptKey: 'zh.a1.func_price',
        stem: '在商店想问价钱，你说？',
        prompt: '选择最合适的回答。',
        options: ['这个多少钱？', '这个多少个？', '现在几点？', '厕所在哪里？'],
        correctIndex: 0,
        explanation: '问价格。',
      },
      {
        conceptKey: 'zh.a1.func_thanks',
        stem: '有人帮你开门。你说？',
        prompt: '选择最合适的回答。',
        options: ['谢谢。', '对不起。', '你好。', '不客气。'],
        correctIndex: 0,
        explanation: '道谢。',
      },
    ],
    A2: [
      {
        conceptKey: 'zh.a2.func_repeat',
        stem: '你没听清地址。你说？',
        prompt: '选择最合适的回答。',
        options: ['请再说一遍，好吗？', '请说小声一点，好吗？', '最近的火车站在哪？', '票多少钱？'],
        correctIndex: 0,
        explanation: '请求重复。',
      },
      {
        conceptKey: 'zh.a2.func_suggest_time',
        stem: '你想提议六点见面。你说？',
        prompt: '选择最合适的回答。',
        options: ['我们六点见，好吗？', '我们昨天六点见过。', '抱歉，我现在忙。', '票多少钱？'],
        correctIndex: 0,
        explanation: '提议时间。',
      },
    ],
    B1: [
      {
        conceptKey: 'zh.b1.func_soft_refuse',
        stem: '同事今晚约你，你已有安排。你说？',
        prompt: '选择最合适的回答。',
        options: [
          '很想去，可是我已经有安排了。',
          '行，我随时都能来。',
          '你为什么问我这个？',
          '请把发票发给我。',
        ],
        correctIndex: 0,
        explanation: '委婉拒绝。',
      },
      {
        conceptKey: 'zh.b1.func_confirm_deadline',
        stem: '你想确认周五是否仍是截止日期。你说？',
        prompt: '选择最合适的回答。',
        options: [
          '确认一下：周五还是截止日期吗？',
          '请今天取消整个项目。',
          '我先不管截止日期。',
          '能借我一下电脑吗？',
        ],
        correctIndex: 0,
        explanation: '礼貌确认。',
      },
    ],
    B2: [
      {
        conceptKey: 'zh.b2.func_hedge',
        stem: '会上你部分不同意风险评估。你说？',
        prompt: '选择最合适的回答。',
        options: [
          '我理解你的观点，不过我会换个角度权衡风险。',
          '你在所有点上都完全错了。',
          '我毫无保留地同意每一处细节。',
          '我们还是聊聊午饭吧。',
        ],
        correctIndex: 0,
        explanation: '有保留的异议。',
      },
      {
        conceptKey: 'zh.b2.func_extension',
        stem: '报告还需要两天。你说？',
        prompt: '选择最合适的回答。',
        options: [
          '截止日期能否延长两天？',
          '我立刻退出这个项目。',
          '请把报告从共享盘删掉。',
          '截止日期从来都不重要。',
        ],
        correctIndex: 0,
        explanation: '礼貌延期请求。',
      },
    ],
  },
};

export const ZH_POOLS = mergeZhHighPools(ZH_POOLS_BASE);
