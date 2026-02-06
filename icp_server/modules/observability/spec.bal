import ballerina/http;
import icp_server.types as types;


@http:ServiceConfig {
    basePath: "/"
}
public type OpensearchService service object {
    *http:ServiceContract;

    resource function post logs(@http:Header {name: "X-API-Key"} string? apiKeyHeader, @http:Payload types:LogEntryRequest logRequest) returns types:LogEntriesResponse|http:BadRequest|error;

    resource function post metrics(@http:Header {name: "X-API-Key"} string? apiKeyHeader, @http:Payload types:MetricEntryRequest metricRequest) returns types:MetricEntriesResponse|http:BadRequest|error;
};
