/* 左下角玩家徽章（个人信息卡）专属配置：头像、名字、职业、等级、UID 与权限等阶都在这里维护。
   avatar 为 public/ 下站点根路径，组件按部署 base 自动拼接；留空则回退为 avatarLabel 占位框。
   徽章是流式排版（不走逐字 x/y 测量布局），改文案无需重新测量；但名字栏在原字号下只容得下
   约 7 个英文字母，副标题超宽时依赖 player-badge.css 末尾的 nowrap 规则保持单行。 */

import type { PlayerContent } from "../components/player-badge";

export const PLAYER_CONFIG: PlayerContent = {
  avatarLabel: "avatar",
  avatar: "/assets/aut-master.webp",
  name: "MMZMING",
  sub: "全干工程师/技术博主",
  level: "60",
  uid: "UID:114514",
  permLabel: "权限等阶",
  permTier: "满级",
};
