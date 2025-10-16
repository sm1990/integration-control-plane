-- Enhanced Lua Scripts for Fluent Bit - Ballerina Focus
-- scripts/scripts.lua

function extract_app_from_path(tag, timestamp, record)
    if record["log_file_path"] then
        local path = record["log_file_path"]
        -- Extract application name from path like /var/log/ballerina/ballerina-app/app.log
        local app_name = string.match(path, "/var/log/[^/]+/([^/]+)/")
        if app_name then
            record["app_name"] = app_name
        else
            record["app_name"] = "unknown"
        end
        
        -- Extract service type from path
        local service_type = string.match(path, "/var/log/([^/]+)/")
        if service_type then
            record["service_type"] = service_type
        end
    end
    return 1, timestamp, record
end

function construct_bal_app_name(tag, timestamp, record)
    local deployment = record["app_name"] or "unknown"
    
    local moduleName = record["module"]
    if record["src.module"] then
        moduleName = record["src.module"]
    end

    if moduleName then
        record["app"] = deployment .. " - " .. moduleName
    else
        record["app"] = deployment 
    end
    
    record["deployment"] = deployment
    return 1, timestamp, record
end

function extract_bal_metrics_data(tag, timestamp, record)
    -- Only process if this is a metrics log
    if record["logger"] ~= "metrics" then
        return 1, timestamp, record
    end

    local transport = record["protocol"] or "Unknown"
    local integration = record["src.object.name"] or "Unknown"
    
    if record["src.main"] == "true" then
        integration = "main"
    end
    
    local sublevel = record["entrypoint.function.name"] or ""
    local method = record["http.method"] or ""
    local response_time = record["response_time_seconds"] or 0
    local status = "successful"
    
    if record["http.status_code_group"] == "4xx" or record["http.status_code_group"] == "5xx" then
        status = "failed"
    end

    -- Convert to milliseconds and round
    response_time = response_time * 1000
    response_time = math.floor(response_time + 0.5)

    record["response_time"] = response_time
    record["status"] = status
    record["protocol"] = transport
    record["integration"] = integration
    record["sublevel"] = sublevel
    record["method"] = method
    record["url"] = record["http.url"] or ""
    record["status_code_group"] = record["http.status_code_group"] or ""

    return 1, timestamp, record
end

function enrich_bal_logs(tag, timestamp, record)
    -- Add common fields for all Ballerina logs
    record["product"] = "ballerina integrator"
    
    -- Extract module info if available
    if record["module"] then
        local module_parts = {}
        for part in string.gmatch(record["module"], "[^/]+") do
            table.insert(module_parts, part)
        end
        if #module_parts > 0 then
            record["app_module"] = module_parts[1]
        end
    end
    
    return 1, timestamp, record
end
