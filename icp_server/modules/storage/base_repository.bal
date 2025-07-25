import ballerina/sql;

public client class BaseRepository {
    final sql:Client dbClient;

    public function init(sql:Client dbClient) {
        self.dbClient = dbClient;
    }

    // Common helper methods
    isolated function toJsonString(anydata value) returns string|error {
        json|error jsonValue = value.cloneWithType(json);
        if jsonValue is error {
            return error("Failed to convert to JSON", jsonValue);
        }
        return jsonValue.toJsonString();
    }

    isolated function fromJsonString(string jsonStr, typedesc<anydata> targetType) returns anydata|error {
        json|error jsonValue = jsonStr.fromJsonString();
        if jsonValue is error {
            return error("Invalid JSON string", jsonValue);
        }
        return jsonValue.cloneWithType(targetType);
    }
}
