/*
 * Copyright (c) 2022, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
 *
 */

package org.wso2.ei.dashboard.core.rest.delegates.configs;

import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.wso2.config.mapper.ConfigParser;
import org.wso2.dashboard.security.user.core.UserStoreManagerUtils;
import org.wso2.dashboard.security.user.core.common.DataHolder;
import org.wso2.ei.dashboard.core.rest.model.SuperAdminUser;
import org.wso2.micro.integrator.security.user.api.RealmConfiguration;

/**
 * Delegate class get config details.
 */
public class ConfigsDelegate {
    private static final Log log = LogFactory.getLog(ConfigsDelegate.class);

    public SuperAdminUser getSuperUser() {
        log.debug("Retrieving super user from system properties.");
        SuperAdminUser superAdminUser = new SuperAdminUser();
        String superAdminUserName = (String) ConfigParser.getParsedConfigs().get("super_admin.username");
        superAdminUser.setUsername(superAdminUserName);
        return superAdminUser;
    }

    public boolean isJdbcUserStoreConfigured() {
        log.debug("Checking if JDBC user store is configured.");
        try {
            if (UserStoreManagerUtils.isFileBasedUserStoreEnabled()) {
                log.debug("File-based user store is enabled. JDBC user store is not configured.");
                return false;
            }

            RealmConfiguration realmConfig = DataHolder.getInstance().getRealmConfig();
            if (realmConfig == null) {
                // Try to initialize user store to get realm config
                UserStoreManagerUtils.getUserStoreManager();
                realmConfig = DataHolder.getInstance().getRealmConfig();
            }

            if (realmConfig != null) {
                String userStoreClass = realmConfig.getUserStoreClass();
                boolean isJdbc = "org.wso2.dashboard.security.user.core.jdbc.JDBCUserStoreManager"
                        .equals(userStoreClass);
                log.info("User store class: " + userStoreClass + ", is JDBC: " + isJdbc);
                return isJdbc;
            }

            log.debug("Realm configuration is null. JDBC user store is not configured.");
            return false;
        } catch (Exception e) {
            log.error("Error while checking JDBC user store configuration", e);
            return false;
        }
    }
}
