import type { IconType } from "react-icons";
import { FaClock, FaCode, FaDatabase, FaJava, FaRocket, FaWandMagicSparkles } from "react-icons/fa6";
import {
  SiAlibabacloud,
  SiApachekafka,
  SiDocker,
  SiElasticsearch,
  SiFastapi,
  SiGrafana,
  SiJenkins,
  SiKubernetes,
  SiMinio,
  SiMongodb,
  SiMysql,
  SiPostgresql,
  SiPrometheus,
  SiPython,
  SiRabbitmq,
  SiReact,
  SiRedis,
  SiSqlalchemy,
  SiSpring,
  SiVuedotjs,
} from "react-icons/si";

/* 技术栈品牌图标（映射与 3D-HOME 的 profile-card 一致；缺图标的用通用占位）。
   Simple Icons 覆盖品牌，Font Awesome 补 Java / 数据库 / RocketMQ / XXL-Job / Vibe Coding。 */
const TECH_ICONS: Record<string, IconType> = {
  "vibe-coding": FaWandMagicSparkles,
  java: FaJava,
  python: SiPython,
  spring: SiSpring,
  "spring-cloud": SiSpring,
  fastapi: SiFastapi,
  sqlalchemy: SiSqlalchemy,
  react: SiReact,
  vue: SiVuedotjs,
  mysql: SiMysql,
  oracle: FaDatabase,
  mongodb: SiMongodb,
  postgresql: SiPostgresql,
  redis: SiRedis,
  elasticsearch: SiElasticsearch,
  rocketmq: FaRocket,
  rabbitmq: SiRabbitmq,
  kafka: SiApachekafka,
  oss: SiAlibabacloud,
  "xxl-job": FaClock,
  minio: SiMinio,
  prometheus: SiPrometheus,
  grafana: SiGrafana,
  jenkins: SiJenkins,
  docker: SiDocker,
  kubernetes: SiKubernetes,
  plsql: FaDatabase,
};

export function TechStackIcon({ name }: { name: string }) {
  const Icon = TECH_ICONS[name] ?? FaCode;
  return <Icon className="ef-idlg__tech-icon" aria-hidden="true" />;
}
