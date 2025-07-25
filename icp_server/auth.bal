// import ballerina/http;
// import ballerina/jwt;
// import ballerina/log;
// import ballerina/time;

// // JWT verification function
// public function verifyJWT(string token) returns UserClaims|error {
//     jwt:Payload payload = check jwt:validate(token, {
//                                                         issuer: jwtIssuer,
//                                                         audience: jwtAudience,
//                                                         jwtSecret: jwtSecret
//                                                     });

//     // Extract custom claims
//     map<json>? customClaims = <map<json>?>payload["customClaims"];
//     string[] roles = [];

//     if customClaims is map<json> && customClaims.hasKey("roles") {
//         json rolesJson = customClaims["roles"];
//         if rolesJson is json[] {
//             foreach json role in rolesJson {
//                 if role is string {
//                     roles.push(role);
//                 }
//             }
//         }
//     }

//     return {
//         sub: <string>payload.sub,
//         roles: roles,
//         exp: <int>payload.exp
//     };
// }

// // Generate JWT token (for testing/admin purposes)
// public function generateJWT(string userId, string[] roles) returns string|error {
//     jwt:Header header = {alg: jwt:RS256, typ: "JWT"};

//     int currentTime = <int>time:utcNow()[0];
//     int expiryTime = currentTime + (jwtExpiryHours * 3600);

//     jwt:Payload payload = {
//         iss: jwtIssuer,
//         aud: jwtAudience,
//         sub: userId,
//         exp: expiryTime,
//         iat: currentTime,
//         customClaims: {
//             "roles": roles,
//             "type": "access_token"
//         }
//     };

//     return jwt:issue(payload, {jwtSecret: jwtSecret});
// }

// // Role-based authorization
// public function hasRole(UserClaims user, string requiredRole) returns boolean {
//     return user.roles.indexOf(requiredRole) != ();
// }

// public function hasAnyRole(UserClaims user, string[] requiredRoles) returns boolean {
//     foreach string role in requiredRoles {
//         if hasRole(user, role) {
//             return true;
//         }
//     }
//     return false;
// }

// // Authentication interceptor for management APIs
// public service class AuthInterceptor {
//     *http:RequestInterceptor;

//     resource function 'default [string... path](http:RequestContext ctx, http:Request req) returns http:NextService|http:Response|error? {
//         // Get authorization header
//         string|http:HeaderNotFoundError authHeader = req.getHeader("Authorization");

//         if authHeader is http:HeaderNotFoundError {
//             http:Response response = new;
//             response.statusCode = 401;
//             response.setJsonPayload({
//                 "error": "unauthorized",
//                 "message": "Authorization header is required"
//             });
//             return response;
//         }

//         if !authHeader.startsWith("Bearer ") {
//             http:Response response = new;
//             response.statusCode = 401;
//             response.setJsonPayload({
//                 "error": "unauthorized",
//                 "message": "Invalid authorization format. Use 'Bearer <token>'"
//             });
//             return response;
//             return;
//         }

//         string token = authHeader.substring(7);
//         UserClaims|error claims = verifyJWT(token);

//         if claims is error {
//             log:printWarn("JWT verification failed", claims);
//             http:Response response = new;
//             response.statusCode = 401;
//             response.setJsonPayload({
//                 "error": "unauthorized",
//                 "message": "Invalid or expired token"
//             });
//             return response;
//             return;
//         }

//         // Add user claims to context for downstream services
//         ctx.set("user", claims);

//         // Extract client IP for audit logging
//         string|error clientIP = req.getHeader("X-Forwarded-For");
//         if clientIP is error {
//             var xRealIpHeader = req.getHeader("X-Real-IP");
//             clientIP = xRealIpHeader is string ? xRealIpHeader : "unknown";
//         }
//         ctx.set("client_ip", clientIP);

//         // Extract user agent
//         string userAgent = req.getHeader("User-Agent") ?: "unknown";
//         ctx.set("user_agent", userAgent);

//         log:printDebug(string `Authenticated user: ${claims.sub} with roles: ${claims.roles.toString()}`);

//         return ctx.next();
//     }
// }

// // Role-based authorization interceptor
// public service class RoleInterceptor {
//     *http:RequestInterceptor;

//     private final string[] requiredRoles;

//     public function init(string[] requiredRoles) {
//         self.requiredRoles = requiredRoles;
//     }

//     resource function 'default [string... path](http:RequestContext ctx, http:Request req) returns http:NextService|http:Response|error? {
//         UserClaims? user = <UserClaims?>ctx.get("user");

//         if user is () {
//             http:Response response = new;
//             response.statusCode = 401;
//             response.setJsonPayload({
//                 "error": "unauthorized",
//                 "message": "Authentication required"
//             });
//             return response;
//         }

//         if !hasAnyRole(user, self.requiredRoles) {
//             log:printWarn(string `User ${user.sub} attempted unauthorized access. Required roles: ${self.requiredRoles.toString()}, User roles: ${user.roles.toString()}`);

//             http:Response response = new;
//             response.statusCode = 403;
//             response.setJsonPayload({
//                 "error": "forbidden",
//                 "message": string `Insufficient permissions. Required roles: ${self.requiredRoles.toString()}`
//             });
//             return response;
//         }

//         return ctx.next();
//     }
// }

// // Utility functions for extracting user context
// public function getUserFromContext(http:RequestContext ctx) returns UserClaims? {
//     return <UserClaims?>ctx.get("user");
// }

// public function getClientIPFromContext(http:RequestContext ctx) returns string {
//     return <string>ctx.get("client_ip") ?: "unknown";
// }

// public function getUserAgentFromContext(http:RequestContext ctx) returns string {
//     return <string>ctx.get("user_agent") ?: "unknown";
// }
