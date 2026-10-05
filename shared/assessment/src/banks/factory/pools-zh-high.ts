import type { AssessmentSkill, CefrLevel } from '../../types.js';
import type { PoolItem } from './pools-en.js';

/**
 * Chinese C1/C2 pool expansion (Phase B.3).
 * Focus: register, stance, implication, discourse, near-synonym nuance —
 * NOT rare 成语 trivia, NOT broken distractors.
 */
export const ZH_HIGH_POOLS: Record<
  AssessmentSkill,
  Partial<Record<'C1' | 'C2', PoolItem[]>>
> = {
  grammar: {
    C1: [
      {
        conceptKey: 'zh.c1.grammar_written_register',
        stem:
          '法务备忘中写明：须经法务部门书面同意后，该修订方可 ____ 生效；口头承诺不具约束力。',
        prompt: '选择最合适的用语。',
        options: ['正式', '随便', '赶紧', '临时'],
        correctIndex: 0,
        explanation: '书面语搭配「正式生效」。',
      },
      {
        conceptKey: 'zh.c1.grammar_ba_result',
        stem:
          '请把供应商延误对交付节奏的影响 ____ 进本周风险说明，但不要写任何退款承诺。',
        prompt: '选择正确的形式。',
        options: ['写', '写了', '写着', '被写'],
        correctIndex: 0,
        explanation: '把字句：把 + 宾语 + 动词。',
      },
      {
        conceptKey: 'zh.c1.grammar_suiran',
        stem:
          '____ 本季度销售额略有回升，管理层仍决定维持招聘冻结，以免成本反弹。',
        prompt: '选择正确的关联词语。',
        options: ['尽管', '因为', '所以', '只要'],
        correctIndex: 0,
        explanation: '尽管……仍……表让步转折。',
      },
      {
        conceptKey: 'zh.c1.grammar_buzhi',
        stem:
          '这份说明 ____ 澄清了流程，也暗示现有方案尚不足以应对下季度的波动。',
        prompt: '选择正确的关联词语。',
        options: ['不仅', '只是', '除非', '既然'],
        correctIndex: 0,
        explanation: '不仅……也……递进。',
      },
      {
        conceptKey: 'zh.c1.grammar_bei_agency',
        stem:
          '原计划中的试点城市 ____ 临时取消，改由总部统一安排下一轮评估。',
        prompt: '选择正确的形式。',
        options: ['被', '把', '让', '给'],
        correctIndex: 0,
        explanation: '被动：被 + 动词。',
      },
      {
        conceptKey: 'zh.c1.grammar_de_nuance',
        stem:
          '他解释得相当 ____ ，听者仍能感到弦外之音：真正的障碍是时间表，而不是预算本身。',
        prompt: '选择正确的形式。',
        options: ['克制', '含糊', '急躁', '夸张'],
        correctIndex: 0,
        explanation: '程度补语/评价：说得克制。',
      },
    ],
    C2: [
      {
        conceptKey: 'zh.c2.grammar_counterfactual',
        stem:
          '若无昨日在核算中发现的那处误差，预算 ____ 在上周的常委会上就已获得通过。',
        prompt: '选择最准确的情态表达。',
        options: ['本可以', '一定会', '正在', '从来都'],
        correctIndex: 0,
        explanation: '反事实：本可以。',
      },
      {
        conceptKey: 'zh.c2.grammar_discourse_contrast',
        stem:
          '单位成本确实下降了；____ ，招聘冻结仍在，多支团队继续反映人手紧张与交付压力。',
        prompt: '选择最合适的衔接。',
        options: ['不过', '因为', '所以', '或者'],
        correctIndex: 0,
        explanation: '转折衔接：不过。',
      },
      {
        conceptKey: 'zh.c2.grammar_yizhi',
        stem:
          '委员会先表示「有兴趣」，____ 未要求后续材料，也未安排表决，便转入下一议题。',
        prompt: '选择最贴切的衔接。',
        options: ['却', '就', '才', '再'],
        correctIndex: 0,
        explanation: '却标示出乎意料的转折。',
      },
      {
        conceptKey: 'zh.c2.grammar_ningke',
        stem:
          '与其在信息不完整时强行上线，____ 把范围收窄，先保证核心路径可测、可回滚。',
        prompt: '选择正确的关联。',
        options: ['不如', '而且', '于是', '或者就'],
        correctIndex: 0,
        explanation: '与其……不如……。',
      },
      {
        conceptKey: 'zh.c2.grammar_lian',
        stem:
          '连内部评审材料 ____ 尚未齐备，对外承诺具体上线日显然不合时宜。',
        prompt: '选择正确的形式。',
        options: ['都', '也才', '再', '又被'],
        correctIndex: 0,
        explanation: '连……都……强调。',
      },
      {
        conceptKey: 'zh.c2.grammar_suoyi_inverted',
        stem:
          '之所以迟迟不公开路线图，____ 供应链与合规节点仍存在未关闭的风险项。',
        prompt: '选择正确的关联。',
        options: ['是因为', '所以才', '即使', '除非'],
        correctIndex: 0,
        explanation: '之所以……是因为……。',
      },
    ],
  },
  vocabulary: {
    C1: [
      {
        conceptKey: 'zh.c1.vocab_mitigate_register',
        stem:
          '在给投资者的风险备忘录里，作者试图 ____ 对延期的剩余顾虑，但并未承诺退款，也没有给出新的时间表。',
        prompt: '选择最合适的词。',
        options: ['缓解', '放大', '忽视', '庆祝'],
        correctIndex: 0,
        explanation: '缓解顾虑=降低其强度。',
      },
      {
        conceptKey: 'zh.c1.vocab_fuyan_stance',
        stem:
          '他的语气仍算客气，但对提案明显带着 ____ ：先道谢，随即换题，并不讨论任何实质内容。',
        prompt: '选择最合适的词。',
        options: ['敷衍', '热情', '好奇', '感激'],
        correctIndex: 0,
        explanation: '敷衍=礼貌推开、不认真对待。',
      },
      {
        conceptKey: 'zh.c1.vocab_register_kouyu',
        stem:
          '对客户说「你们这方案不行」过于生硬；更稳妥的书面表达是指出 ____ ，并给出可讨论的调整方向。',
        prompt: '选择最合适的词。',
        options: ['局限', '笑话', '脾气', '运气'],
        correctIndex: 0,
        explanation: '书面语：指出局限。',
      },
      {
        conceptKey: 'zh.c1.vocab_colloc_chengdan',
        stem:
          '若在测试未完成前提前发布，团队将难以 ____ 由此可能引发的可用性事故责任。',
        prompt: '选择最合适的词。',
        options: ['承担', '抬起', '推开', '庆祝'],
        correctIndex: 0,
        explanation: '承担责任。',
      },
      {
        conceptKey: 'zh.c1.vocab_near_biaotai',
        stem:
          '纪要写「记录在案并表示兴趣」，通常更接近礼貌的 ____ ，而不是已经批准执行。',
        prompt: '选择最合适的词。',
        options: ['观望', '拨款', '解雇', '庆祝'],
        correctIndex: 0,
        explanation: '观望=暂不表态支持。',
      },
      {
        conceptKey: 'zh.c1.vocab_written_vs_spoken',
        stem:
          '对内可以随口说「先放放」；对外邮件里更妥当的说法是建议将该事项 ____ 至下一阶段评估。',
        prompt: '选择最合适的词。',
        options: ['延后', '扔掉', '忘掉', '取消'],
        correctIndex: 0,
        explanation: '书面：延后评估。',
      },
    ],
    C2: [
      {
        conceptKey: 'zh.c2.vocab_stance_liuyudi',
        stem:
          '她结尾感谢评委提出「有意思的方向」，并说它「或许更适合下一阶段」，却未给出下一步。这一立场更接近 ____ ，而非支持。',
        prompt: '选择最贴切的概括。',
        options: ['留有余地', '热情支持', '敌意回绝', '例行表态'],
        correctIndex: 0,
        explanation: '礼貌推迟、不承诺。',
      },
      {
        conceptKey: 'zh.c2.vocab_colloc_zhiyi',
        stem:
          '新的发货日志公开后，几位分析师认为这些数字对早前「六月前完成去库存」的预测 ____ 。',
        prompt: '选择最合适的搭配。',
        options: ['提出质疑', '表示庆祝', '完全证实', '置之不理'],
        correctIndex: 0,
        explanation: '对预测提出质疑。',
      },
      {
        conceptKey: 'zh.c2.vocab_near_anashi',
        stem:
          '「我们欣赏构想，时间安排是障碍」在商务邮件中通常 ____ 为暂缓或婉拒，而非立刻批准。',
        prompt: '选择最准确的词。',
        options: ['解读', '朗读', '抄写', '删除'],
        correctIndex: 0,
        explanation: '解读言外之意。',
      },
      {
        conceptKey: 'zh.c2.vocab_register_weiban',
        stem:
          '把「先放放」写成「建议暂缓启动并补充评估材料」，主要改变的是 ____ ，而不是事实本身。',
        prompt: '选择最准确的词。',
        options: ['语体', '天气', '人数', '字体大小'],
        correctIndex: 0,
        explanation: '口语→书面的语体调整。',
      },
      {
        conceptKey: 'zh.c2.vocab_stance_baoliu',
        stem:
          '「我认同目标，但需要更清晰的成功指标」表达的是有条件的 ____ ，而不是无保留背书。',
        prompt: '选择最准确的词。',
        options: ['认同', '否决', '嘲讽', '弃权'],
        correctIndex: 0,
        explanation: '有条件认同。',
      },
      {
        conceptKey: 'zh.c2.vocab_discourse_qianzai',
        stem:
          '「感谢分发草案」之后立刻「转入其他议题且无表决」，会话含义上往往 ____ 该提案缺乏推进动能。',
        prompt: '选择最准确的词。',
        options: ['暗示', '证明数学上', '否认', '庆祝'],
        correctIndex: 0,
        explanation: '暗示=语用含意。',
      },
    ],
  },
  reading: {
    C1: [
      {
        conceptKey: 'zh.c1.read_understate_critique',
        stem:
          '审稿意见：「文章结构清楚，文笔克制。不过核心论断依赖一个作者几乎未加检验的前提，这削弱了后文建议的力度。」主要批评是什么？',
        prompt: '选择最佳答案。',
        options: [
          '论断的基础检验不足',
          '文字混乱难读',
          '完全没有论点',
          '前提早已被证明',
        ],
        correctIndex: 0,
        explanation: '未检验的前提=实质批评。',
      },
      {
        conceptKey: 'zh.c1.read_discourse_contrast',
        stem:
          '季报摘录：「第二季度单位成本在更换供应商后再度下降。尽管如此，招聘冻结仍在，多支团队反映产能紧张。」「尽管如此」标示什么关系？',
        prompt: '选择最佳答案。',
        options: [
          '转折/出乎意料的延续',
          '招聘冻结的原因',
          '第二季度的定义',
          '同义词罗列',
        ],
        correctIndex: 0,
        explanation: '尽管如此=转折。',
      },
      {
        conceptKey: 'zh.c1.read_email_soft_no',
        stem:
          '客户来信：「我们欣赏贵方构想；当前排期与合规节点是主要障碍，建议下季度再议。」发信人最可能的意图是？',
        prompt: '选择最佳答案。',
        options: [
          '礼貌地推迟或婉拒',
          '立即批准并拨款',
          '要求立刻涨价',
          '宣布终止合作',
        ],
        correctIndex: 0,
        explanation: '障碍+下季度再议=软拒绝/推迟。',
      },
      {
        conceptKey: 'zh.c1.read_register_shift',
        stem:
          '内部聊天写「这事儿先放放」；对外纪要写成「建议将该事项延后至材料齐备后再议」。两段文字主要差别是？',
        prompt: '选择最佳答案。',
        options: [
          '语体与对象：口语对内 vs 书面对外',
          '事实完全相反',
          '只是字体不同',
          '对外版本否认存在该事项',
        ],
        correctIndex: 0,
        explanation: '同一命题，语体与受众不同。',
      },
      {
        conceptKey: 'zh.c1.read_implication_hiring',
        stem:
          '备忘录：「成本优化初见成效。管理层重申在需求能见度改善前，不新增编制。」对招聘意味着什么？',
        prompt: '选择最佳答案。',
        options: [
          '短期内仍难新增岗位',
          '立刻大规模扩招',
          '所有合同自动解除',
          '只招聘实习生',
        ],
        correctIndex: 0,
        explanation: '不新增编制=招聘冻结延续。',
      },
      {
        conceptKey: 'zh.c1.read_stance_review',
        stem:
          '评论：「论证整齐，但关键前提几乎未经检验，后续建议因此力度不足。」作者态度最接近？',
        prompt: '选择最佳答案。',
        options: [
          '有保留的批评',
          '全面赞扬',
          '完全否定写作能力',
          '对主题不感兴趣',
        ],
        correctIndex: 0,
        explanation: '肯定形式、批评实质。',
      },
    ],
    C2: [
      {
        conceptKey: 'zh.c2.read_implicature_minutes',
        stem:
          '会议纪要：「委员感谢作者分发草案。委员会对该提案表示兴趣并记录在案，随后未要求后续文件也未表决，便迅速转入其他议题。」最可能的语用解读是？',
        prompt: '选择最佳答案。',
        options: [
          '礼貌地不表态，而非批准',
          '一致通过拨款',
          '要求立即实施',
          '秘书记录错误',
        ],
        correctIndex: 0,
        explanation: '兴趣+无后续≈搁置。',
      },
      {
        conceptKey: 'zh.c2.read_ambiguity_which',
        stem:
          '合同条款：「参与者可在通知后退出；该通知须为书面，并至少于生效日前十天送达秘书处。」什么必须是书面的？',
        prompt: '选择最佳答案。',
        options: [
          '通知',
          '活动结束后的退出行为本身',
          '参与者本人',
          '没有特别要求',
        ],
        correctIndex: 0,
        explanation: '「该通知」回指通知。',
      },
      {
        conceptKey: 'zh.c2.read_rhetorical_contrast',
        stem:
          '发言稿：「我们欢迎创新试点；同时，在安全评估未完成前，任何对外承诺具体日期的做法都不妥当。」说话人的修辞关系是？',
        prompt: '选择最佳答案。',
        options: [
          '先肯定方向，再设硬性边界',
          '全面否定创新',
          '只谈日期无关安全',
          '宣布立即上线',
        ],
        correctIndex: 0,
        explanation: '欢迎+同时限制=有条件支持。',
      },
      {
        conceptKey: 'zh.c2.read_dense_hedge',
        stem:
          '分析短评：「增长『很可能』出现，『尽管』供应风险『仍不可忽视』。在缺乏新订单能见度前，扩产应保持克制。」作者整体立场？',
        prompt: '选择最佳答案。',
        options: [
          '谨慎乐观并主张克制扩产',
          '断言必将高增长',
          '要求立即停产',
          '对风险毫不在意',
        ],
        correctIndex: 0,
        explanation: '很可能+尽管+克制=hedged。',
      },
      {
        conceptKey: 'zh.c2.read_indirect_request',
        stem:
          '上级留言：「如果方便，不妨把那份对照表也附上；当然，若这周实在排不开，下周一也行。」对下属最合理的理解是？',
        prompt: '选择最佳答案。',
        options: [
          '希望尽快附上，但允许轻微延期',
          '明确禁止附对照表',
          '必须下周一才交',
          '对照表无关紧要可忽略',
        ],
        correctIndex: 0,
        explanation: '间接催促+留余地。',
      },
      {
        conceptKey: 'zh.c2.read_info_structure',
        stem:
          '句段：「参与者可退出——在送达书面通知之后，并且该通知须提前十天到达秘书处。」信息焦点主要落在？',
        prompt: '选择最佳答案。',
        options: [
          '退出的程序性条件',
          '参与者的国籍',
          '秘书处的装修',
          '十天假期安排',
        ],
        correctIndex: 0,
        explanation: '焦点在程序条件。',
      },
    ],
  },
  functional: {
    C1: [
      {
        conceptKey: 'zh.c1.func_pushback_scope',
        stem:
          '客户坚持激进上线日，若接受将迫使跳过关键测试。你需要在不撕破关系的前提下把风险说清楚。你说？',
        prompt: '选择最合适的回答。',
        options: [
          '若缩小范围，我们可以冲这个日期；否则质量会受影响。',
          '日期没问题，测试可以全免。',
          '我们拒绝，因为你总是错的。',
          '你自己定，把结果发我们就行。',
        ],
        correctIndex: 0,
        explanation: '有条件的外交推回。',
      },
      {
        conceptKey: 'zh.c1.func_deescalate',
        stem:
          '规划讨论变得激烈且低效，双方开始互相指责。你想拉回结构并降温，怎么说？',
        prompt: '选择最合适的回答。',
        options: [
          '也许先搁置争议点，列出我们已经一致的部分。',
          '别说了，我已经替大家决定好了。',
          '我们假装没有分歧。',
          '一吵起来就散会，也不做记录。',
        ],
        correctIndex: 0,
        explanation: '降温并重组议程。',
      },
      {
        conceptKey: 'zh.c1.func_request_extension',
        stem:
          '报告还差关键对照数据，你需要两天。客户在催。你怎样提出延期最稳妥？',
        prompt: '选择最合适的回答。',
        options: [
          '截止日期能否延长两天？我们可以先提交已完成部分供预审。',
          '我立刻退出这个项目。',
          '请把报告从共享盘删掉。',
          '截止日期从来都不重要。',
        ],
        correctIndex: 0,
        explanation: '礼貌延期并给出过渡方案。',
      },
      {
        conceptKey: 'zh.c1.func_hedged_disagree',
        stem:
          '会上同事断言风险「完全可控」。你不完全同意，又不想正面冲突。你说？',
        prompt: '选择最合适的回答。',
        options: [
          '我理解你的判断，不过我会把供应链波动权取得更重一些。',
          '你在所有点上都完全错了。',
          '我毫无保留地同意每一处细节。',
          '我们还是聊聊午饭吧。',
        ],
        correctIndex: 0,
        explanation: '有保留的异议。',
      },
      {
        conceptKey: 'zh.c1.func_clarify_written',
        stem:
          '对方口头说「差不多就行」，你担心范围不清。你怎样用更正式的方式确认？',
        prompt: '选择最合适的回答。',
        options: [
          '为避免误解，我们是否把验收标准写成书面清单再确认一次？',
          '差不多就行，不用再问。',
          '你们爱怎样怎样。',
          '请直接取消合同。',
        ],
        correctIndex: 0,
        explanation: '推动书面澄清。',
      },
      {
        conceptKey: 'zh.c1.func_soft_refuse_invite',
        stem:
          '合作方邀请你本周五晚宴谈「非正式敲定」。你已有安排，且希望保持专业距离。你说？',
        prompt: '选择最合适的回答。',
        options: [
          '感谢邀请；我周五已有安排，能否改到工作时间的短会？',
          '行，我随时都能来，什么都先答应。',
          '为什么问我这个？',
          '请把发票先发我。',
        ],
        correctIndex: 0,
        explanation: '婉拒并改到正式场合。',
      },
    ],
    C2: [
      {
        conceptKey: 'zh.c2.func_indirect_decline',
        stem:
          '对方提案方向有吸引力，但现阶段资源与合规都不支持推进。你想婉拒又不伤关系。你说？',
        prompt: '选择最合适的回答。',
        options: [
          '这个方向有意思，或许更适合放到下一阶段再评估。',
          '不行，以后别再联系我们谈这个。',
          '这个想法毫无价值，今天就该放弃。',
          '我们全盘批准并立即拨款。',
        ],
        correctIndex: 0,
        explanation: '间接推迟。',
      },
      {
        conceptKey: 'zh.c2.func_partial_align',
        stem:
          '战略讨论中你认同目标方向，但不能无条件背书执行细节。你说？',
        prompt: '选择最合适的回答。',
        options: [
          '我认同这个目标，但需要更清晰的成功指标后再谈资源承诺。',
          '我无条件批准每一个细节。',
          '我否定目标，却大力称赞指标。',
          '这种认同等于已签署的法律承诺。',
        ],
        correctIndex: 0,
        explanation: '有条件的部分认同。',
      },
      {
        conceptKey: 'zh.c2.func_implicature_close',
        stem:
          '漫长争论后你想收束，既承认对方关切，又避免当场拍板。你说？',
        prompt: '选择最合适的回答。',
        options: [
          '这些点值得写入风险清单；今天先确认事实，决策放到材料齐备后再做。',
          '我已经决定了，你们照做。',
          '争论没用，散会且不留记录。',
          '我们现在就签字批准全部条款。',
        ],
        correctIndex: 0,
        explanation: '程序化收束、推迟决策。',
      },
      {
        conceptKey: 'zh.c2.func_register_repair',
        stem:
          '你刚才对客户说得偏冲。需要当场补救语气，但不收回实质立场。你说？',
        prompt: '选择最合适的回答。',
        options: [
          '刚才用词急了；我的意思是：在测试完成前，我们不宜锁定对外日期。',
          '我说的每一句都没错，你们必须接受。',
          '对不起，我们放弃所有质量要求。',
          '请当我什么都没说，日期随便定。',
        ],
        correctIndex: 0,
        explanation: '修复语体、坚持实质。',
      },
      {
        conceptKey: 'zh.c2.func_stance_align_public',
        stem:
          '公开场合你需要表态支持创新，同时避免被理解成已批准高风险试点。你说？',
        prompt: '选择最合适的回答。',
        options: [
          '我们欢迎试点构想，具体推进仍以安全评估与书面范围为前提。',
          '我们已经全盘批准，下周上线。',
          '创新没有意义，一律禁止。',
          '评估不重要，先做了再说。',
        ],
        correctIndex: 0,
        explanation: '公开支持+条件边界。',
      },
      {
        conceptKey: 'zh.c2.func_clarify_ambiguity',
        stem:
          '合同草稿写「通知后可退出」，但未写清「通知」形式。谈判桌上你怎样提出澄清最精准？',
        prompt: '选择最合适的回答。',
        options: [
          '建议写明：退出通知须为书面，并在生效日前至少十天送达秘书处。',
          '不用写清楚，大家心里有数。',
          '删除退出条款即可。',
          '通知用口头就够了。',
        ],
        correctIndex: 0,
        explanation: '消除歧义的精准澄清。',
      },
    ],
  },
};

export function mergeZhHighPools(
  base: Record<AssessmentSkill, Partial<Record<CefrLevel, PoolItem[]>>>,
): Record<AssessmentSkill, Partial<Record<CefrLevel, PoolItem[]>>> {
  const out = { ...base } as Record<AssessmentSkill, Partial<Record<CefrLevel, PoolItem[]>>>;
  for (const skill of Object.keys(ZH_HIGH_POOLS) as AssessmentSkill[]) {
    out[skill] = {
      ...out[skill],
      C1: ZH_HIGH_POOLS[skill].C1,
      C2: ZH_HIGH_POOLS[skill].C2,
    };
  }
  return out;
}
