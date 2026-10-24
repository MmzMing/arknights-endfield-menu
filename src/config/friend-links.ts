/* 站点友链：条目同步自博客的 src/config/friendsConfig.ts（enabled 项，保持原顺序）。
   rss 是逐站探测到的 RSS/Atom 源（扫描首页 <link rel="alternate"> 后回退常见路径）；没探测到的留空。
   顶栏的“友链”计数与友链弹窗都读这份列表。 */
export interface FriendLink {
  name: string;
  url: string;
  /** 一句话描述，展示在弹窗条目右侧 */
  description?: string;
  /** 站点 RSS/Atom 源，供后续聚合或订阅使用 */
  rss?: string;
}

export const FRIEND_LINKS: FriendLink[] = [
  {
    name: "Firefly Docs",
    url: "https://docs-firefly.cuteleaf.cn",
    description: "Firefly主题模板文档",
  },
  {
    name: "番茄主理人",
    url: "https://blog.fqzlr.top/",
    description: "坐而言不如起而行.",
    rss: "https://blog.fqzlr.top/rss.xml",
  },
  {
    name: "琳心",
    url: "https://karina.xin/",
    description: "恣意探索 放弃就到此为止啦….",
  },
  {
    name: "二叉树树",
    url: "https://2x.nz/",
    description: "Protect What You Love.",
    rss: "https://2x.nz/rss.xml",
  },
  {
    name: "流欺の博客",
    url: "https://blog.lqay.cn/",
    description: "嗯对就是个博客",
    rss: "https://blog.lqay.cn/?feed=rss2",
  },
  {
    name: "xf_blog",
    url: "https://xfcnl.github.io/",
    description: "立志用 cloudflare workers，GitHub pages 和 vercel 做出整个互联网的up（虽然不会成功",
    rss: "https://xfchannel.top/feed.xml",
  },
  {
    name: "星轨手札",
    url: "https://yuulog.org/",
    description: "德国留学、日本旅行与技术折腾记录",
    rss: "https://yuulog.org/rss.xml",
  },
  {
    name: "楠枝小笺",
    url: "https://www.nanzhiy.cn/",
    description: "安安静静地存在，就已经很好啦。",
    rss: "https://www.nanzhiy.cn/rss.xml",
  },
  {
    name: "UpXuu",
    url: "https://upxuu.com/",
    description: "逐光而上",
    rss: "https://upxuu.com/rss.xml",
  },
  {
    name: "椰汁の博客",
    url: "https://home.132614.xyz/",
    description: "关关难过关关过,前路漫漫亦灿灿.",
  },
  {
    name: "Sigrika-善良耙耙柑🍊",
    url: "https://qwq.sigrika.cc/",
    description: "记录我的二次元之旅",
    rss: "https://qwq.sigrika.cc/rss.xml",
  },
  {
    name: "团子和蛋糕",
    url: "https://blog.tsh520.cn/",
    description: "如果你喜欢那么欢迎来到我的世界！",
    rss: "https://blog.tsh520.cn/rss.xml",
  },
  {
    name: "mccsjs",
    url: "https://mccsjs.cn/",
    description: "点一盏灯，等待一个迷路的夜🍁",
    rss: "https://mccsjs.cn/rss.xml",
  },
  {
    name: "抚七kilroy",
    url: "https://fuqikilroy.github.io/HEXO/",
    description: "记录与分享技术的每一刻,同时享受生活的点滴",
  },
  {
    name: "ysdy~Blog",
    url: "https://ysdyblog.ccwu.cc/",
    description: "人生苦短，摆烂优先",
    rss: "https://ysdyblog.ccwu.cc/rss.xml",
  },
  {
    name: "YFBLOG - 幻新至简",
    url: "https://yfblog.asia/",
    description: "随手笔记，技术心得分享",
  },
  {
    name: "阿叶Ayeez的小站",
    url: "https://blog.Ayeez.cn",
    description: "记录学习历程，记录美好生活",
  },
  {
    name: "云灿の随笔小站",
    url: "https://blog.yuncan.xyz/",
    description: "浮云一别后，流水十年间",
    rss: "https://blog.yuncan.xyz/atom.xml",
  },
  {
    name: "阿的宝藏之地",
    url: "https://nothing-new.icu/",
    description: "记录项目、数学思考与杂谈。",
  },
  {
    name: "Olinl Blog",
    url: "https://blog.olinl.com/",
    description: "分享、实践、学习",
  },
  {
    name: "星遐蝶梦",
    url: "https://blog.casto.top/",
    description: "星穹漫遐，蝶携清梦。",
    rss: "https://blog.casto.top/rss.xml",
  },
  {
    name: "雾语",
    url: "https://foglog.cn/",
    description: "迷雾轻语，雅意深藏",
    rss: "https://foglog.cn/feed/",
  },
  {
    name: "Kanako的小窝",
    url: "https://blog.kanako.top/",
    description: "宁静致远，厚积薄发",
    rss: "https://blog.kanako.top/rss.xml",
  },
  {
    name: "RAGNote",
    url: "https://ragnote.top/",
    description: "一堆水文的小站，记录学习过程、项目实践，以及那些让我感兴趣的事物。Life is code. I will debug it.",
    rss: "https://api.ragnote.top/rss.xml",
  },
  {
    name: "拾玖的博客",
    url: "https://shijiucode.cn/",
    description: "人间风情千万般，值得觊觎一眼。",
  },
  {
    name: "Meet Blog 博客星图",
    url: "https://meet-blog.buyixiao.xyz/?ref=https%3A%2F%2Ftblog.mmzhiku.xyz/",
    description: "Meet Blog 博客星图",
  },
  {
    name: "Aimerting",
    url: "https://blog.xuioo.com/",
    description: "「纯粹祈愿皆成真」",
    rss: "https://blog.xuioo.com/rss.xml",
  },
  {
    name: "静かな森",
    url: "https://innei.in/",
    description: "致虚极，守静笃。",
    rss: "https://innei.in/feed",
  },
  {
    name: "月读空间",
    url: "https://yachiyo.hk/",
    description: "超时空辉夜姬同人小站",
    rss: "https://yachiyo.hk/rss.xml",
  },
  {
    name: "Eliauk",
    url: "https://eliauk312.top/",
    description: "一方天地，记录代码、生活和偶尔的奇思妙想。",
  },
  {
    name: "小鱼钓猫🐱",
    url: "https://blog.z2m.store/",
    description: "技术成长、生活随笔",
    rss: "https://blog.z2m.store/rss.xml",
  },
  {
    name: "拾光小筑",
    url: "https://devcoding.me/",
    description: "一个工程师与写作者的小角落，记录代码、设计、生活与思考",
  },
  {
    name: "星诺的博客",
    url: "https://blog.astrvow.com/",
    description: "只要热爱，太阳就会升起！",
    rss: "https://blog.astrvow.com/rss.xml",
  },
  {
    name: "伊linxiyy-微博客",
    url: "https://lxya.net/",
    description: "记录生活，分享技术，留住美好瞬间",
  },
  {
    name: "Neuro的博客",
    url: "https://blog.neurosama.com/",
    description: "Neuro的胡思乱想随记",
    rss: "https://blog.neurosama.com/feed.xml",
  },
  {
    name: "年华",
    url: "https://blog.amamo.top/",
    description: "分享生活和技术。",
    rss: "https://blog.amamo.top/rss.xml",
  },
  {
    name: "星空驿站 Starlight Station",
    url: "https://baiyangmu.xyz/",
    description: "一座漂浮在深空中的小小驿站",
    rss: "https://baiyangmu.xyz/rss.xml",
  },
  {
    name: "临渊羡鱼",
    url: "https://x1anyu.cn/",
    description: "久有羡鱼意，不甘空望川. 躬身耕岁月，步步赴清澜",
    rss: "https://x1anyu.cn/rss.xml",
  },
  {
    name: "闪程-猫条的笔记",
    url: "https://blog.shancheng.cq.cn/",
    description: "分享技术与生活的小天地~",
  },
  {
    name: "Yukihime",
    url: "https://yukihime.dev/",
    description: "你的瞳色 是我生命苦寻的永生花",
    rss: "https://yukihime.dev/rss.xml",
  },
  {
    name: "毛",
    url: "https://blog.huchao.vip/",
    description: "如果有不可能，那就去创造！",
    rss: "https://blog.huchao.vip/rss.xml",
  },
  {
    name: "vemiyの小站",
    url: "https://www.vemiy.com/",
    description: "One more day.",
    rss: "https://www.vemiy.com/atom.xml",
  },
  {
    name: "夜白的小屋",
    url: "https://yibi2333.fun/",
    description: "这个人很懒，什么都没留下",
  },
  {
    name: "星宇安全实验室",
    url: "https://bk.zhaozhiqiang.pw/",
    description: "星宇安全实验室，专注网络安全技术分享，记录团队实战经历、安全研究与编程成长笔记，致力于分享网安学习干货。",
    rss: "https://bk.zhaozhiqiang.pw/feed",
  },
  {
    name: "Tonks’ blog",
    url: "https://blog.tonks.top/",
    description: "带我去你梦里的彼岸",
    rss: "https://blog.tonks.top/rss.xml",
  },
  {
    name: "夏夜流萤",
    url: "https://blog.cuteleaf.cn/",
    description: "飞萤之火自无梦的长夜亮起，绽放在终竟的明天。",
    rss: "https://blog.cuteleaf.cn/rss.xml",
  },
  {
    name: "lijie blog",
    url: "https://lijie.cool",
    description: "懒于当下，勤于长远",
  },
  {
    name: "Moyor的炼药小锅",
    url: "https://moyor.cc/",
    description: "把代码、美术与创意熬成游戏的炼药锅。",
  },
  {
    name: "冷汐的杂货铺",
    url: "https://lengxiqwq.com/",
    description: "你好谢谢小笼包再见！",
    rss: "https://lengxiqwq.com/rss.xml",
  },
  {
    name: "Fuhao574",
    url: "https://www.fuhao574.cyou/",
    description: "这个世界不缺大人",
    rss: "https://www.fuhao574.cyou/rss.xml",
  },
  {
    name: "姓王者的博客",
    url: "https://xingwangzhe.fun/",
    description: "探索、学习、进步、创造无限可能！",
    rss: "https://xingwangzhe.fun/rss.xml",
  },
  {
    name: "左沐の手册",
    url: "https://azuma.mstzuomu.space",
    description: "热爱是拯救无趣人生的唯一途径",
    rss: "https://azuma.mstzuomu.space/rss.xml",
  },
  {
    name: "xane",
    url: "https://xane.eu.cc",
    description: "Keep going.",
  },
  {
    name: "YuJing的记忆终端",
    url: "https://yujingblog.top",
    description: "记一些无用的日常，和有光的时刻。",
    rss: "https://yujingblog.top/rss.xml",
  },
  {
    name: "夢酷",
    url: "https://imki.cn",
    description: "Crafting Dreams In Code.",
    rss: "https://imki.cn/rss.xml",
  },
  {
    name: "HZH",
    url: "https://clannad.top",
    description: "Welcome to HZH",
    rss: "https://clannad.top/feed.xml",
  },
  {
    name: "云泽の小屋",
    url: "https://zeyun.org/",
    description: "一个记录技术探索，学习实践与网络安全实践的小站",
    rss: "https://zeyun.org/rss.xml",
  },
  {
    name: "zuige's blog",
    url: "https://blog.zuiges.com",
    description: "软件开发 · 玩机折腾 · 技术随手记",
    rss: "https://blog.zuiges.com/atom.xml",
  },
  {
    name: "张萌萌",
    url: "https://blog.nw177.cn",
    description: "春风得意马蹄疾 一日看尽长安花",
    rss: "https://blog.nw177.cn/rss.xml",
  },
  {
    name: "AIOVTUE-雪",
    url: "https://daily.yybb.us",
    description: "雨滴会记录生命中的每一个瞬间",
    rss: "https://daily.yybb.us/index.xml",
  },
  {
    name: "wuxian’s blog",
    url: "https://alxian.cn",
    description: "个人博客",
    rss: "https://www.alxian.cn/rss.xml",
  },
];
