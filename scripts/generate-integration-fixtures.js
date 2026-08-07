'use strict';

/**
 * Gera fixtures de integration (projetos minimos compilaveis).
 * Uso: node scripts/generate-integration-fixtures.js
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'tests', 'fixtures', 'integration');

function w(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.endsWith('\n') ? content : `${content}\n`);
}

function javaApp(pkg, className = 'App') {
  return `package ${pkg};

public class ${className} {
  public static String hello() {
    return "hello";
  }

  public static void main(String[] args) {
    System.out.println(hello());
  }
}
`;
}

function mavenPom({ artifactId, release, packaging = 'jar', deps = '', extra = '' }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.afrika.veracode.fixtures</groupId>
  <artifactId>${artifactId}</artifactId>
  <version>0.0.1</version>
  <packaging>${packaging}</packaging>
  <properties>
    <maven.compiler.release>${release}</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  </properties>
${deps}
  <build>
    <plugins>
      <plugin>
        <artifactId>maven-compiler-plugin</artifactId>
        <version>3.13.0</version>
        <configuration>
          <debug>true</debug>
          <debuglevel>lines,vars,source</debuglevel>
        </configuration>
      </plugin>
      <plugin>
        <artifactId>maven-jar-plugin</artifactId>
        <version>3.4.2</version>
      </plugin>
${extra}
    </plugins>
  </build>
</project>
`;
}

function gradleJavaVersionEnum(v) {
  if (v === '8') return 'VERSION_1_8';
  return `VERSION_${v}`;
}

// --- Java Maven runtime matrix ---
for (const v of ['8', '11', '17', '21', '25', '26']) {
  const release = v === '8' ? '8' : v;
  const dir = `java/maven/java${v}-basic`;
  w(`${dir}/pom.xml`, mavenPom({ artifactId: `java${v}-basic`, release }));
  w(`${dir}/src/main/java/com/example/App.java`, javaApp('com.example'));
}

// Spring Boot 17 / 21 (framework tests — one stack each)
w(
  'java/maven/springboot-java17/pom.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.5</version>
  </parent>
  <groupId>com.afrika.veracode.fixtures</groupId>
  <artifactId>springboot-java17</artifactId>
  <version>0.0.1</version>
  <properties>
    <java.version>17</java.version>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter</artifactId>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
      <plugin>
        <artifactId>maven-compiler-plugin</artifactId>
        <configuration>
          <debug>true</debug>
          <debuglevel>lines,vars,source</debuglevel>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
`
);
w(
  'java/maven/springboot-java17/src/main/java/com/example/Application.java',
  `package com.example;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {
  public static void main(String[] args) {
    SpringApplication.run(Application.class, args);
  }
}
`
);

w(
  'java/maven/springboot-java21/pom.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.5</version>
  </parent>
  <groupId>com.afrika.veracode.fixtures</groupId>
  <artifactId>springboot-java21</artifactId>
  <version>0.0.1</version>
  <properties>
    <java.version>21</java.version>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter</artifactId>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>
`
);
w(
  'java/maven/springboot-java21/src/main/java/com/example/Application.java',
  `package com.example;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {
  public static void main(String[] args) {
    SpringApplication.run(Application.class, args);
  }
}
`
);

// WAR Java 17
w(
  'java/maven/war-java17/pom.xml',
  mavenPom({
    artifactId: 'war-java17',
    release: '17',
    packaging: 'war',
    deps: `  <dependencies>
    <dependency>
      <groupId>jakarta.servlet</groupId>
      <artifactId>jakarta.servlet-api</artifactId>
      <version>6.0.0</version>
      <scope>provided</scope>
    </dependency>
  </dependencies>`,
    extra: `      <plugin>
        <artifactId>maven-war-plugin</artifactId>
        <version>3.4.0</version>
        <configuration>
          <failOnMissingWebXml>false</failOnMissingWebXml>
        </configuration>
      </plugin>`
  })
);
w('java/maven/war-java17/src/main/java/com/example/App.java', javaApp('com.example'));
w(
  'java/maven/war-java17/src/main/webapp/WEB-INF/web.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns="https://jakarta.ee/xml/ns/jakartaee" version="5.0">
  <display-name>war-java17</display-name>
</web-app>
`
);

// Multimodule Java 17
w(
  'java/maven/multimodule-java17/pom.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.afrika.veracode.fixtures</groupId>
  <artifactId>multimodule-java17</artifactId>
  <version>0.0.1</version>
  <packaging>pom</packaging>
  <modules>
    <module>core</module>
  </modules>
  <properties>
    <maven.compiler.release>17</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  </properties>
</project>
`
);
w('java/maven/multimodule-java17/core/pom.xml', mavenPom({ artifactId: 'multimodule-core', release: '17' }));
w('java/maven/multimodule-java17/core/src/main/java/com/example/App.java', javaApp('com.example'));

// --- Java Gradle ---
for (const v of ['8', '11', '17', '21', '25', '26']) {
  const dir = `java/gradle/java${v}-basic`;
  w(
    `${dir}/build.gradle`,
    `plugins {
  id 'java'
}

java {
  sourceCompatibility = JavaVersion.${gradleJavaVersionEnum(v)}
  targetCompatibility = JavaVersion.${gradleJavaVersionEnum(v)}
}

tasks.withType(JavaCompile).configureEach {
  options.debug = true
  options.debugOptions.debugLevel = 'source,lines,vars'
}
`
  );
  w(`${dir}/settings.gradle`, `rootProject.name = 'java${v}-basic'\n`);
  w(`${dir}/src/main/java/com/example/App.java`, javaApp('com.example'));
  w(
    `${dir}/gradle/wrapper/gradle-wrapper.properties`,
    `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.10.2-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`
  );
}

w(
  'java/gradle/kotlin-dsl-java17/build.gradle.kts',
  `plugins {
    java
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}

tasks.withType<JavaCompile>().configureEach {
    options.isDebug = true
    options.debugOptions.debugLevel = "source,lines,vars"
}
`
);
w('java/gradle/kotlin-dsl-java17/settings.gradle.kts', `rootProject.name = "kotlin-dsl-java17"\n`);
w('java/gradle/kotlin-dsl-java17/src/main/java/com/example/App.java', javaApp('com.example'));
w(
  'java/gradle/kotlin-dsl-java17/gradle/wrapper/gradle-wrapper.properties',
  `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.10.2-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`
);

w(
  'java/gradle/springboot-java17/build.gradle',
  `plugins {
  id 'java'
  id 'org.springframework.boot' version '3.3.5'
  id 'io.spring.dependency-management' version '1.1.6'
}

java {
  sourceCompatibility = JavaVersion.VERSION_17
  targetCompatibility = JavaVersion.VERSION_17
}

dependencies {
  implementation 'org.springframework.boot:spring-boot-starter'
}
`
);
w('java/gradle/springboot-java17/settings.gradle', `rootProject.name = 'springboot-java17'\n`);
w(
  'java/gradle/springboot-java17/src/main/java/com/example/Application.java',
  `package com.example;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {
  public static void main(String[] args) {
    SpringApplication.run(Application.class, args);
  }
}
`
);
w(
  'java/gradle/springboot-java17/gradle/wrapper/gradle-wrapper.properties',
  `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.10.2-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`
);

w(
  'java/gradle/multimodule-java17/settings.gradle',
  `rootProject.name = 'multimodule-java17'
include 'core'
`
);
w(
  'java/gradle/multimodule-java17/build.gradle',
  `subprojects {
  apply plugin: 'java'
  java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
}
`
);
w('java/gradle/multimodule-java17/core/build.gradle', `// module core\n`);
w('java/gradle/multimodule-java17/core/src/main/java/com/example/App.java', javaApp('com.example'));
w(
  'java/gradle/multimodule-java17/gradle/wrapper/gradle-wrapper.properties',
  `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.10.2-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`
);

function pkg(obj) {
  return `${JSON.stringify(obj, null, 2)}\n`;
}

// --- JavaScript (SOURCE_PACKAGE — no prod build) ---
w(
  'javascript/vanilla-node/package.json',
  pkg({ name: 'vanilla-node', version: '1.0.0', main: 'index.js', engines: { node: '>=18' } })
);
w(
  'javascript/vanilla-node/package-lock.json',
  pkg({ name: 'vanilla-node', lockfileVersion: 3, requires: true, packages: {} })
);
w(
  'javascript/vanilla-node/index.js',
  `module.exports = { hello: () => 'hello' };\nconsole.log(module.exports.hello());\n`
);

w(
  'javascript/express/package.json',
  pkg({
    name: 'express-fixture',
    version: '1.0.0',
    main: 'index.js',
    dependencies: { express: '4.21.2' },
    engines: { node: '>=18' }
  })
);
w(
  'javascript/express/package-lock.json',
  pkg({
    name: 'express-fixture',
    lockfileVersion: 3,
    requires: true,
    packages: { '': { dependencies: { express: '4.21.2' } } }
  })
);
w(
  'javascript/express/index.js',
  `const express = require('express');
const app = express();
app.get('/', (_req, res) => res.send('ok'));
module.exports = app;
`
);

w(
  'javascript/react/package.json',
  pkg({
    name: 'react-fixture',
    version: '1.0.0',
    private: true,
    dependencies: { react: '18.3.1', 'react-dom': '18.3.1' }
  })
);
w(
  'javascript/react/package-lock.json',
  pkg({
    name: 'react-fixture',
    lockfileVersion: 3,
    requires: true,
    packages: { '': { dependencies: { react: '18.3.1', 'react-dom': '18.3.1' } } }
  })
);
w('javascript/react/src/App.jsx', `export function App() { return <div>hello</div>; }\n`);
w('javascript/react/index.js', `module.exports = { name: 'react-fixture' };\n`);

// Representative frameworks (minimal package.json + source; lock stub)
for (const [name, dep, file, body] of [
  [
    'nextjs',
    { next: '14.2.18', react: '18.3.1', 'react-dom': '18.3.1' },
    'pages/index.js',
    `export default function Home() { return <h1>hello</h1>; }\n`
  ],
  [
    'vue',
    { vue: '3.5.12' },
    'src/App.vue',
    `<template><p>hello</p></template>\n<script>export default { name: 'App' }</script>\n`
  ],
  ['angular', { '@angular/core': '18.2.0' }, 'src/main.js', `export const appName = 'angular-fixture';\n`],
  [
    'nestjs',
    { '@nestjs/core': '10.4.4', '@nestjs/common': '10.4.4', 'reflect-metadata': '0.2.2', rxjs: '7.8.1' },
    'src/main.js',
    `exports.boot = () => 'nestjs';\n`
  ]
]) {
  w(
    `javascript/${name}/package.json`,
    pkg({ name: `${name}-fixture`, version: '1.0.0', private: true, dependencies: dep })
  );
  w(
    `javascript/${name}/package-lock.json`,
    pkg({
      name: `${name}-fixture`,
      lockfileVersion: 3,
      requires: true,
      packages: { '': { dependencies: dep } }
    })
  );
  w(`javascript/${name}/${file}`, body);
}

// yarn representative for nestjs — add yarn.lock marker (already have package-lock; use nestjs-yarn)
w(
  'javascript/nestjs-yarn/package.json',
  pkg({
    name: 'nestjs-yarn',
    version: '1.0.0',
    dependencies: { '@nestjs/core': '10.4.4', '@nestjs/common': '10.4.4', 'reflect-metadata': '0.2.2', rxjs: '7.8.1' }
  })
);
w(
  'javascript/nestjs-yarn/yarn.lock',
  [
    '# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.',
    '# yarn lockfile v1',
    '',
    '"@nestjs/core@10.4.4":',
    '  version "10.4.4"',
    ''
  ].join('\n')
);
w('javascript/nestjs-yarn/src/main.js', `exports.boot = () => 'nestjs-yarn';\n`);

w('javascript/vue-pnpm/package.json', pkg({ name: 'vue-pnpm', version: '1.0.0', dependencies: { vue: '3.5.12' } }));
w(
  'javascript/vue-pnpm/pnpm-lock.yaml',
  `lockfileVersion: '9.0'\n\nimporters:\n  .:\n    dependencies:\n      vue:\n        specifier: 3.5.12\n        version: 3.5.12\n`
);
w('javascript/vue-pnpm/src/App.vue', `<template><p>hello</p></template>\n`);

// --- TypeScript ---
w(
  'typescript/node-typescript/package.json',
  pkg({
    name: 'node-typescript',
    version: '1.0.0',
    main: 'src/index.ts',
    devDependencies: { typescript: '5.6.3' }
  })
);
w(
  'typescript/node-typescript/package-lock.json',
  pkg({
    name: 'node-typescript',
    lockfileVersion: 3,
    requires: true,
    packages: { '': { devDependencies: { typescript: '5.6.3' } } }
  })
);
w(
  'typescript/node-typescript/tsconfig.json',
  pkg({ compilerOptions: { target: 'ES2020', module: 'commonjs', strict: true }, include: ['src'] })
);
w(
  'typescript/node-typescript/src/index.ts',
  `export function hello(): string { return 'hello'; }\nconsole.log(hello());\n`
);

w(
  'typescript/express-typescript/package.json',
  pkg({
    name: 'express-typescript',
    version: '1.0.0',
    dependencies: { express: '4.21.2' },
    devDependencies: { typescript: '5.6.3', '@types/express': '4.17.21', '@types/node': '20.16.11' }
  })
);
w(
  'typescript/express-typescript/package-lock.json',
  pkg({
    name: 'express-typescript',
    lockfileVersion: 3,
    requires: true,
    packages: { '': { dependencies: { express: '4.21.2' }, devDependencies: { typescript: '5.6.3' } } }
  })
);
w(
  'typescript/express-typescript/tsconfig.json',
  pkg({ compilerOptions: { target: 'ES2020', module: 'commonjs', strict: true }, include: ['src'] })
);
w(
  'typescript/express-typescript/src/index.ts',
  `import express from 'express';
const app = express();
app.get('/', (_req, res) => res.send('ok'));
export default app;
`
);

w(
  'typescript/react-typescript/package.json',
  pkg({
    name: 'react-typescript',
    version: '1.0.0',
    dependencies: { react: '18.3.1' },
    devDependencies: { typescript: '5.6.3', '@types/react': '18.3.11' }
  })
);
w(
  'typescript/react-typescript/package-lock.json',
  pkg({
    name: 'react-typescript',
    lockfileVersion: 3,
    requires: true,
    packages: { '': { dependencies: { react: '18.3.1' }, devDependencies: { typescript: '5.6.3' } } }
  })
);
w(
  'typescript/react-typescript/tsconfig.json',
  pkg({ compilerOptions: { jsx: 'react-jsx', strict: true }, include: ['src'] })
);
w('typescript/react-typescript/src/App.tsx', `export function App(): JSX.Element { return <div>hello</div>; }\n`);

w(
  'typescript/nextjs-typescript/package.json',
  pkg({
    name: 'nextjs-typescript',
    version: '1.0.0',
    dependencies: { next: '14.2.18', react: '18.3.1', 'react-dom': '18.3.1' },
    devDependencies: { typescript: '5.6.3', '@types/react': '18.3.11' }
  })
);
w(
  'typescript/nextjs-typescript/package-lock.json',
  pkg({
    name: 'nextjs-typescript',
    lockfileVersion: 3,
    requires: true,
    packages: { '': { dependencies: { next: '14.2.18', react: '18.3.1', 'react-dom': '18.3.1' } } }
  })
);
w(
  'typescript/nextjs-typescript/tsconfig.json',
  pkg({ compilerOptions: { jsx: 'preserve', strict: true }, include: ['pages'] })
);
w('typescript/nextjs-typescript/pages/index.tsx', `export default function Home() { return <h1>hello</h1>; }\n`);

w(
  'typescript/nestjs-typescript/package.json',
  pkg({
    name: 'nestjs-typescript',
    version: '1.0.0',
    dependencies: { '@nestjs/core': '10.4.4', '@nestjs/common': '10.4.4', 'reflect-metadata': '0.2.2', rxjs: '7.8.1' },
    devDependencies: { typescript: '5.6.3' }
  })
);
w(
  'typescript/nestjs-typescript/package-lock.json',
  pkg({
    name: 'nestjs-typescript',
    lockfileVersion: 3,
    requires: true,
    packages: { '': { dependencies: { '@nestjs/core': '10.4.4' } } }
  })
);
w(
  'typescript/nestjs-typescript/tsconfig.json',
  pkg({ compilerOptions: { target: 'ES2020', module: 'commonjs', strict: true }, include: ['src'] })
);
w('typescript/nestjs-typescript/src/main.ts', `export function boot(): string { return 'nestjs'; }\n`);

// --- .NET ---
function csprojConsole(tfm) {
  return `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>${tfm}</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
</Project>
`;
}

function programCs() {
  return `Console.WriteLine("hello");\n`;
}

for (const v of ['6', '7', '8', '9', '10']) {
  w(`dotnet/net${v}-console/App.csproj`, csprojConsole(`net${v}.0`));
  w(`dotnet/net${v}-console/Program.cs`, programCs());
}

w(
  'dotnet/net8-webapi/App.csproj',
  `<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
</Project>
`
);
w(
  'dotnet/net8-webapi/Program.cs',
  `var app = WebApplication.CreateBuilder(args).Build();
app.MapGet("/", () => "ok");
app.Run();
`
);

w(
  'dotnet/net8-classlibrary/Lib.csproj',
  `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
</Project>
`
);
w(
  'dotnet/net8-classlibrary/Greeter.cs',
  `namespace Lib;\npublic static class Greeter { public static string Hello() => "hello"; }\n`
);

w(
  'dotnet/net8-aspnet-core/App.csproj',
  `<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
</Project>
`
);
w(
  'dotnet/net8-aspnet-core/Program.cs',
  `var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
app.MapGet("/health", () => Results.Ok("ok"));
app.Run();
`
);

w(
  'dotnet/net8-blazor-wasm/App.csproj',
  `<Project Sdk="Microsoft.NET.Sdk.BlazorWebAssembly">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <BlazorEnableCompression>false</BlazorEnableCompression>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Components.WebAssembly" Version="8.0.10" />
    <PackageReference Include="Microsoft.AspNetCore.Components.WebAssembly.DevServer" Version="8.0.10" PrivateAssets="all" />
  </ItemGroup>
</Project>
`
);
w(
  'dotnet/net8-blazor-wasm/Program.cs',
  `using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
var builder = WebAssemblyHostBuilder.CreateDefault(args);
await builder.Build().RunAsync();
`
);
w('dotnet/net8-blazor-wasm/wwwroot/index.html', `<!DOCTYPE html><html><body><div id="app">hello</div></body></html>\n`);
w(
  'dotnet/net8-blazor-wasm/App.razor',
  `@page "/"
<h1>hello</h1>
`
);
w('dotnet/net8-blazor-wasm/_Imports.razor', `@using System.Net.Http\n`);

w(
  'dotnet/net8-azure-functions/App.csproj',
  `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <AzureFunctionsVersion>v4</AzureFunctionsVersion>
    <OutputType>Exe</OutputType>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.Azure.Functions.Worker" Version="1.23.0" />
    <PackageReference Include="Microsoft.Azure.Functions.Worker.Sdk" Version="1.18.1" />
    <PackageReference Include="Microsoft.Azure.Functions.Worker.Extensions.Http" Version="3.2.0" />
  </ItemGroup>
</Project>
`
);
w(
  'dotnet/net8-azure-functions/Program.cs',
  `using Microsoft.Extensions.Hosting;
var host = new HostBuilder().ConfigureFunctionsWorkerDefaults().Build();
host.Run();
`
);
w(
  'dotnet/net8-azure-functions/Hello.cs',
  `using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

public class Hello
{
  [Function("Hello")]
  public HttpResponseData Run([HttpTrigger(AuthorizationLevel.Anonymous, "get")] HttpRequestData req)
  {
    var res = req.CreateResponse(HttpStatusCode.OK);
    res.WriteString("ok");
    return res;
  }
}
`
);

// multi-project solution
w(
  'dotnet/multi-project-solution/Multi.sln',
  `Microsoft Visual Studio Solution File, Format Version 12.00
Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "App", "App\\App.csproj", "{11111111-1111-1111-1111-111111111111}"
EndProject
Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "Lib", "Lib\\Lib.csproj", "{22222222-2222-2222-2222-222222222222}"
EndProject
`
);
w('dotnet/multi-project-solution/App/App.csproj', csprojConsole('net8.0'));
w('dotnet/multi-project-solution/App/Program.cs', `Console.WriteLine(Lib.Greeter.Hello());\n`);
w(
  'dotnet/multi-project-solution/Lib/Lib.csproj',
  `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
</Project>
`
);
w(
  'dotnet/multi-project-solution/Lib/Greeter.cs',
  `namespace Lib;\npublic static class Greeter { public static string Hello() => "hello"; }\n`
);
// Fix App to reference Lib
w(
  'dotnet/multi-project-solution/App/App.csproj',
  `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="../Lib/Lib.csproj" />
  </ItemGroup>
</Project>
`
);

w(
  'dotnet/vbnet/App.vbproj',
  `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <RootNamespace>App</RootNamespace>
  </PropertyGroup>
</Project>
`
);
w(
  'dotnet/vbnet/Program.vb',
  `Module Program
  Sub Main(args As String())
    Console.WriteLine("hello")
  End Sub
End Module
`
);

w(
  'dotnet/net48/App.csproj',
  `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net48</TargetFramework>
  </PropertyGroup>
</Project>
`
);
w(
  'dotnet/net48/Program.cs',
  `using System;
namespace App {
  class Program {
    static void Main(string[] args) {
      Console.WriteLine("hello");
    }
  }
}
`
);

// Private deps placeholders (no credentials)
w(
  'private-deps/README.md',
  `# Private dependency fixtures (stubs)

Prepared for future local/mocked registry tests:

- \`maven/\` — settings.xml pointing to a local mock repo (no credentials committed)
- \`nuget/\` — nuget.config with placeholder source
- \`npm/\` — .npmrc with env-var token name only

Do **not** commit real tokens.
`
);
w(
  'private-deps/maven/settings.xml',
  `<?xml version="1.0"?>
<settings>
  <servers>
    <server>
      <id>private-maven</id>
      <username>\${env.MAVEN_USERNAME}</username>
      <password>\${env.MAVEN_PASSWORD}</password>
    </server>
  </servers>
</settings>
`
);
w(
  'private-deps/nuget/nuget.config',
  `<?xml version="1.0"?>
<configuration>
  <packageSources>
    <add key="private" value="https://example.invalid/nuget/v3/index.json" />
  </packageSources>
</configuration>
`
);
w('private-deps/npm/.npmrc', `//example.invalid/:_authToken=\${NPM_TOKEN}\n`);

console.log('Integration fixtures generated at', root);
