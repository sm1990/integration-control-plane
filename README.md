# WSO2 Integration Control Plane

Monitor, troubleshoot and control integration deployments


[![Build Status](https://wso2.org/jenkins/buildStatus/icon?job=products%2Fintegration-control-plane)](https://wso2.org/jenkins/job/products/job/integration-control-plane/)


## Building from the source

### Setting up the development environment

1. Install Node.js [14.X.X](https://nodejs.org/en/download/releases/).
2. Clone the [WSO2 Integration Control Plane repository](https://github.com/wso2/integration-control-plane).
3. Run the following Apache Maven command to build the product.
```mvn clean install```
4. wso2-integration-control-plane-<version>.zip can be found in
 `./distribution/target`.

#### Build in Windows

1. Change executable and argument configuration values to support windows build as follows in _exec-npm-install_, _create-target-dir_ and _exec-npm-build_ executions:
```
<!-- For Windows Build -->
<executable>cmd</executable>
<arguments>
    <argument>/c</argument>
    <argument>npm</argument>
    <argument>install</argument>
    <argument>--legacy-peer-deps</argument>
</arguments>
```
2. Change build script as follows in components/org.wso2.micro.integrator.dashboard.web/web-app/package.json:
```
"build": "react-scripts build && move build ..\\target\\www",
```

### Running

- Extract the generated distribution archive to a preferred location.
  `cd` to the <ICP_HOME>/bin.
  Run dashboard.sh (Linux/macOS) or dashboard.bat (Windows).

- In a web browser, navigate to the displayed URL. i.e: https://localhost:9743/login.
