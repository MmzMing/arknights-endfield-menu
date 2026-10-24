/* 个人档案弹窗（点击左下角玩家卡片打开）的全部可编辑内容。
   TECH_STACK 是档案面板顶部四行指标（label/subLabel/进度）的来源。
   TECH_STACK_GROUPS 是完整技术栈分组（导航胶囊的计数与说明弹窗用），命名/结构同步自
   3D-HOME/src/config/profile.json 的 skills。 */

export interface TechStackMetric {
  id: string;
  /** 行内主标签（中文在前，参考图的“理智剩余”位置） */
  label: string;
  /** 主标签右上角的英文（参考图的 SANITY 位置） */
  subLabel: string;
  /** 当前进度，0–max */
  value: number;
  max: number;
}

export type TechLevel = "low" | "medium" | "high" | "xhigh" | "max" | "ultra";

export interface TechStackItem {
  name: string;
  level: TechLevel;
  /** 品牌图标键（见 components/tech-stack-icon.tsx） */
  icon: string;
}

export interface TechStackGroup {
  label: string;
  items: TechStackItem[];
}

export interface MusicPlaceholder {
  eyebrow: string;
  title: string;
  artist: string;
  /** 播放器主标签（暂停播放） */
  label: string;
  /** 主标签英文 */
  labelEn: string;
}

export interface ProfilePanelContent {
  /** 左侧黄色竖条的小号英文（如 OPERATOR） */
  railSmall: string;
  /** 左侧黄色竖条的大号英文（如 PROFILE） */
  railBig: string;
  techStack: TechStackMetric[];
  music: MusicPlaceholder;
  /** 个人卡上“站点运行天数”的说明 */
  siteLabel: string;
  /** 名字下方的一句话简介 */
  bio: string;
}

export const TECH_STACK: TechStackMetric[] = [
  { id: "java", label: "后端开发", subLabel: "JAVA", value: 70, max: 100 },
  { id: "python", label: "脚本开发", subLabel: "PYTHON", value: 30, max: 100 },
  { id: "agent", label: "智能体", subLabel: "AGENT", value: 30, max: 100 },
  { id: "frontend", label: "前端界面", subLabel: "FRONTEND", value: 60, max: 100 },
];

/** 胶囊上的标签。 */
export const TECH_STACK_LABEL = "技术栈";

export const TECH_STACK_GROUPS: TechStackGroup[] = [
  {
    label: "编程语言",
    items: [
      { name: "Vibe Coding", level: "max", icon: "vibe-coding" },
      { name: "Java", level: "xhigh", icon: "java" },
      { name: "Python", level: "low", icon: "python" },
    ],
  },
  {
    label: "框架与库",
    items: [
      { name: "Spring", level: "xhigh", icon: "spring" },
      { name: "Spring Cloud", level: "high", icon: "spring-cloud" },
      { name: "FastAPI", level: "low", icon: "fastapi" },
      { name: "SQLAlchemy", level: "low", icon: "sqlalchemy" },
      { name: "React", level: "medium", icon: "react" },
      { name: "Vue", level: "high", icon: "vue" },
    ],
  },
  {
    label: "数据库",
    items: [
      { name: "MySQL", level: "xhigh", icon: "mysql" },
      { name: "Oracle", level: "xhigh", icon: "oracle" },
      { name: "MongoDB", level: "medium", icon: "mongodb" },
      { name: "PostgreSQL", level: "medium", icon: "postgresql" },
    ],
  },
  {
    label: "中间件",
    items: [
      { name: "Redis", level: "xhigh", icon: "redis" },
      { name: "Elasticsearch", level: "medium", icon: "elasticsearch" },
      { name: "RocketMQ", level: "xhigh", icon: "rocketmq" },
      { name: "RabbitMQ", level: "high", icon: "rabbitmq" },
      { name: "Kafka", level: "low", icon: "kafka" },
      { name: "阿里云 OSS", level: "high", icon: "oss" },
      { name: "XXL-Job", level: "high", icon: "xxl-job" },
      { name: "MinIO", level: "high", icon: "minio" },
      { name: "Prometheus", level: "medium", icon: "prometheus" },
      { name: "Grafana", level: "low", icon: "grafana" },
    ],
  },
  {
    label: "开发工具",
    items: [
      { name: "Jenkins", level: "low", icon: "jenkins" },
      { name: "Docker", level: "high", icon: "docker" },
      { name: "Kubernetes", level: "medium", icon: "kubernetes" },
      { name: "PL/SQL Developer", level: "xhigh", icon: "plsql" },
    ],
  },
];

export const TECH_STACK_COUNT = TECH_STACK_GROUPS.reduce((total, group) => total + group.items.length, 0);

export const PROFILE_PANEL_CONFIG: ProfilePanelContent = {
  railSmall: "OPERATOR",
  railBig: "PROFILE",
  techStack: TECH_STACK,
  music: {
    eyebrow: "PLAYBACK // 播放器",
    title: "TALOS-II RADIO",
    artist: "MMZMING",
    label: "暂停播放",
    labelEn: "PAUSE PLAYBACK",
  },
  siteLabel: "站点运行时间",
  bio: "在代码与像素之间，搭一座自己的小站。",
};
