// Copyright (c) 2025, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
//
// WSO2 Inc. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
//  http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import ballerina/sql;

// Category of a database error, determined by inspecting the raw sql:Error
// message. Call sites use this to select a domain-specific, user-friendly
// message without the classifier needing to know about any entity.
enum SqlErrorCategory {
    DUPLICATE_KEY,
    VALUE_TOO_LONG,
    FOREIGN_KEY_VIOLATION,
    UNKNOWN_SQL_ERROR
}

// Classifies a raw sql:Error into a high-level category by inspecting
// the error message for well-known database error patterns
// (PostgreSQL, MySQL, MSSQL).
//
// The classifier has NO knowledge of entities, constraint names, or
// user-facing messages — that belongs to the call site.
isolated function classifySqlError(sql:Error err) returns SqlErrorCategory {
    string msg = err.message().toLowerAscii();

    if msg.includes("duplicate key") || msg.includes("duplicate entry") ||
            msg.includes("unique constraint") || msg.includes("unique_violation") {
        return DUPLICATE_KEY;
    }

    if msg.includes("value too long") || msg.includes("data too long") ||
            msg.includes("string or binary data would be truncated") {
        return VALUE_TOO_LONG;
    }

    if msg.includes("foreign key") || msg.includes("violates foreign key") {
        return FOREIGN_KEY_VIOLATION;
    }

    return UNKNOWN_SQL_ERROR;
}
