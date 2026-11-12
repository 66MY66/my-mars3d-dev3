SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `satellite_data_pool` (
  `id` varchar(32) NOT NULL,
  `pool_name` varchar(100) NOT NULL,
  `total_capacity` int DEFAULT 0,
  `used_capacity` int DEFAULT 0,
  `data_type` varchar(100) DEFAULT NULL,
  `satellites` varchar(500) DEFAULT NULL,
  `storage_path` varchar(500) DEFAULT NULL,
  `data_format` varchar(100) DEFAULT NULL,
  `access_mode` varchar(100) DEFAULT NULL,
  `backup_strategy` varchar(200) DEFAULT NULL,
  `status` varchar(32) DEFAULT NULL,
  `create_by` varchar(50) DEFAULT NULL,
  `create_time` datetime DEFAULT NULL,
  `update_by` varchar(50) DEFAULT NULL,
  `update_time` datetime DEFAULT NULL,
  `remark` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='卫星遥感数据资源池';

CREATE TABLE IF NOT EXISTS `satellite_metadata` (
  `id` varchar(32) NOT NULL,
  `satellite` varchar(100) DEFAULT NULL,
  `sensor` varchar(100) DEFAULT NULL,
  `resolution` int DEFAULT NULL,
  `data_type` varchar(100) DEFAULT NULL,
  `observation_time` datetime DEFAULT NULL,
  `cloud_cover` int DEFAULT NULL,
  `sun_elevation` double DEFAULT NULL,
  `sun_azimuth` double DEFAULT NULL,
  `satellite_elevation` double DEFAULT NULL,
  `satellite_azimuth` double DEFAULT NULL,
  `image_extent` varchar(1000) DEFAULT NULL,
  `center_lon` double DEFAULT NULL,
  `center_lat` double DEFAULT NULL,
  `imaging_mode` varchar(100) DEFAULT NULL,
  `orbit_number` varchar(100) DEFAULT NULL,
  `scene_id` varchar(100) DEFAULT NULL,
  `product_level` varchar(50) DEFAULT NULL,
  `processing_level` varchar(50) DEFAULT NULL,
  `projection_crs` varchar(100) DEFAULT NULL,
  `file_size` double DEFAULT NULL,
  `storage_path` varchar(500) DEFAULT NULL,
  `data_source` varchar(200) DEFAULT NULL,
  `quality_assessment` varchar(500) DEFAULT NULL,
  `status` varchar(32) DEFAULT NULL,
  `create_by` varchar(50) DEFAULT NULL,
  `create_time` datetime DEFAULT NULL,
  `update_by` varchar(50) DEFAULT NULL,
  `update_time` datetime DEFAULT NULL,
  `remark` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_satellite_observation_time` (`satellite`, `observation_time`),
  KEY `idx_metadata_scene_id` (`scene_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='卫星遥感元数据';

CREATE TABLE IF NOT EXISTS `satellite_data_catalog` (
  `id` varchar(32) NOT NULL,
  `parent_id` varchar(32) DEFAULT NULL,
  `name` varchar(200) NOT NULL,
  `level` int DEFAULT NULL,
  `dimension` varchar(100) DEFAULT NULL,
  `sort` int DEFAULT 0,
  `data_count` int DEFAULT 0,
  `storage_size` double DEFAULT 0,
  `access_permission` varchar(100) DEFAULT NULL,
  `status` varchar(32) DEFAULT NULL,
  `is_leaf` tinyint(1) DEFAULT 0,
  `path` varchar(1000) DEFAULT NULL,
  `create_by` varchar(50) DEFAULT NULL,
  `create_time` datetime DEFAULT NULL,
  `update_by` varchar(50) DEFAULT NULL,
  `update_time` datetime DEFAULT NULL,
  `description` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_catalog_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='卫星遥感数据目录';

CREATE TABLE IF NOT EXISTS `satellite_data_query` (
  `id` varchar(32) NOT NULL,
  `query_name` varchar(200) DEFAULT NULL,
  `satellite` varchar(100) DEFAULT NULL,
  `data_type` varchar(100) DEFAULT NULL,
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `cloud_cover_range` varchar(100) DEFAULT NULL,
  `resolution_range` varchar(100) DEFAULT NULL,
  `geo_range` varchar(1000) DEFAULT NULL,
  `data_level` varchar(100) DEFAULT NULL,
  `result_count` int DEFAULT 0,
  `status` varchar(32) DEFAULT NULL,
  `is_template` tinyint(1) DEFAULT 0,
  `create_by` varchar(50) DEFAULT NULL,
  `create_time` datetime DEFAULT NULL,
  `remark` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='卫星遥感查询任务';

CREATE TABLE IF NOT EXISTS `satellite_data_share` (
  `id` varchar(32) NOT NULL,
  `data_ids` text,
  `auth_type` varchar(100) DEFAULT NULL,
  `auth_target` text,
  `permissions` varchar(500) DEFAULT NULL,
  `valid_start` datetime DEFAULT NULL,
  `valid_end` datetime DEFAULT NULL,
  `download_limit` int DEFAULT 0,
  `download_count` int DEFAULT 0,
  `audit_status` varchar(32) DEFAULT NULL,
  `audit_comment` varchar(500) DEFAULT NULL,
  `status` varchar(32) DEFAULT NULL,
  `create_by` varchar(50) DEFAULT NULL,
  `create_time` datetime DEFAULT NULL,
  `update_by` varchar(50) DEFAULT NULL,
  `update_time` datetime DEFAULT NULL,
  `remark` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='卫星遥感数据共享';

INSERT INTO `satellite_data_pool` (`id`,`pool_name`,`total_capacity`,`used_capacity`,`data_type`,`satellites`,`storage_path`,`data_format`,`access_mode`,`backup_strategy`,`status`,`create_by`,`create_time`,`remark`) VALUES ('DM_POOL_OPTICAL','光学遥感数据资源池',100,24,'光学影像','GF-1,GF-2,GF-6','/data/satellite/optical','GeoTIFF','在线访问','每日增量、每周全量','正常','system',NOW(),'部署链路验证种子数据') ON DUPLICATE KEY UPDATE `pool_name`=VALUES(`pool_name`),`update_time`=NOW();
INSERT INTO `satellite_metadata` (`id`,`satellite`,`sensor`,`resolution`,`data_type`,`observation_time`,`cloud_cover`,`sun_elevation`,`sun_azimuth`,`center_lon`,`center_lat`,`imaging_mode`,`orbit_number`,`scene_id`,`product_level`,`processing_level`,`projection_crs`,`file_size`,`storage_path`,`data_source`,`quality_assessment`,`status`,`create_by`,`create_time`,`remark`) VALUES ('DM_META_GF1_001','GF-1','PMS',2,'光学影像','2026-10-20 10:30:00',8,48.5,132.1,103.8,30.7,'多光谱','ORB-20261020','GF1-PMS-20261020-001','L2','正射校正','EPSG:4326',1024.5,'/data/satellite/optical/GF1-PMS-20261020-001.tif','部署初始化','通过','有效','system',NOW(),'部署链路验证种子数据') ON DUPLICATE KEY UPDATE `scene_id`=VALUES(`scene_id`),`update_time`=NOW();
INSERT INTO `satellite_data_catalog` (`id`,`parent_id`,`name`,`level`,`dimension`,`sort`,`data_count`,`storage_size`,`access_permission`,`status`,`is_leaf`,`path`,`create_by`,`create_time`,`description`) VALUES ('DM_CATALOG_ROOT',NULL,'卫星遥感数据',1,'数据类型',1,1,1024.5,'内部','正常',0,'/卫星遥感数据','system',NOW(),'部署初始化目录') ON DUPLICATE KEY UPDATE `name`=VALUES(`name`),`update_time`=NOW();
INSERT INTO `satellite_data_query` (`id`,`query_name`,`satellite`,`data_type`,`start_date`,`end_date`,`cloud_cover_range`,`resolution_range`,`data_level`,`result_count`,`status`,`is_template`,`create_by`,`create_time`,`remark`) VALUES ('DM_QUERY_SAMPLE','GF-1低云量数据','GF-1','光学影像','2026-01-01 00:00:00','2026-12-31 23:59:59','0-10','0-5','L2',1,'已完成',1,'system',NOW(),'部署初始化查询模板') ON DUPLICATE KEY UPDATE `query_name`=VALUES(`query_name`);
INSERT INTO `satellite_data_share` (`id`,`data_ids`,`auth_type`,`auth_target`,`permissions`,`valid_start`,`valid_end`,`download_limit`,`download_count`,`audit_status`,`status`,`create_by`,`create_time`,`remark`) VALUES ('DM_SHARE_SAMPLE','DM_META_GF1_001','公开','受控内网','查看,下载',NOW(),DATE_ADD(NOW(), INTERVAL 365 DAY),100,0,'已通过','有效','system',NOW(),'部署初始化共享记录') ON DUPLICATE KEY UPDATE `status`=VALUES(`status`),`update_time`=NOW();
