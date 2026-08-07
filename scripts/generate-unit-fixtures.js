'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'tests', 'fixtures', 'unit');

function w(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function pom({ props = '', packaging = 'jar', deps = '', extra = '' } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>fixture</artifactId>
  <version>0.0.1</version>
  <packaging>${packaging}</packaging>
  <properties>
${props}
  </properties>
${deps}
${extra}
</project>
`;
}

function pkg(obj) {
  return `${JSON.stringify(obj, null, 2)}\n`;
}

w(
  'pom/pom-java8.xml',
  pom({
    props:
      '    <maven.compiler.source>1.8</maven.compiler.source>\n    <maven.compiler.target>1.8</maven.compiler.target>'
  })
);
w('pom/pom-java11.xml', pom({ props: '    <maven.compiler.release>11</maven.compiler.release>' }));
w('pom/pom-java17.xml', pom({ props: '    <maven.compiler.release>17</maven.compiler.release>' }));
w('pom/pom-java21.xml', pom({ props: '    <java.version>21</java.version>' }));
w('pom/pom-java25.xml', pom({ props: '    <maven.compiler.release>25</maven.compiler.release>' }));
w('pom/pom-java26.xml', pom({ props: '    <jdk.version>26</jdk.version>' }));
w(
  'pom/pom-springboot-java17.xml',
  pom({
    props: '    <java.version>17</java.version>',
    deps: `  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter</artifactId>
      <version>3.3.0</version>
    </dependency>
  </dependencies>`
  })
);
w(
  'pom/pom-springboot-java21.xml',
  pom({
    props: '    <java.version>21</java.version>',
    deps: `  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
      <version>3.3.0</version>
    </dependency>
  </dependencies>`
  })
);
w('pom/pom-war.xml', pom({ props: '    <maven.compiler.release>17</maven.compiler.release>', packaging: 'war' }));
w('pom/pom-ear.xml', pom({ props: '    <maven.compiler.release>11</maven.compiler.release>', packaging: 'ear' }));
w(
  'pom/pom-multimodule.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>parent</artifactId>
  <version>0.0.1</version>
  <packaging>pom</packaging>
  <modules>
    <module>api</module>
    <module>core</module>
  </modules>
  <properties>
    <maven.compiler.release>17</maven.compiler.release>
  </properties>
</project>
`
);
w('pom/pom-no-version.xml', pom({ props: '    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>' }));

const mavenCopies = {
  'java17-wrapper': 'pom-java17.xml',
  'java17-no-wrapper': 'pom-java17.xml',
  springboot21: 'pom-springboot-java21.xml',
  war: 'pom-war.xml',
  ear: 'pom-ear.xml',
  multimodule: 'pom-multimodule.xml',
  java8: 'pom-java8.xml',
  java11: 'pom-java11.xml',
  java21: 'pom-java21.xml',
  java25: 'pom-java25.xml',
  java26: 'pom-java26.xml',
  'no-version': 'pom-no-version.xml',
  springboot17: 'pom-springboot-java17.xml'
};

for (const [dir, file] of Object.entries(mavenCopies)) {
  w(`maven-projects/${dir}/pom.xml`, fs.readFileSync(path.join(root, 'pom', file), 'utf8'));
}
w('maven-projects/java17-wrapper/mvnw', '#!/bin/sh\necho mvnw\n');

w(
  'gradle/java17-sourcecompat/build.gradle',
  `plugins { id 'java' }
sourceCompatibility = '17'
targetCompatibility = '17'
`
);
w(
  'gradle/java21-versionenum/build.gradle',
  `plugins { id 'java' }
java {
  sourceCompatibility = JavaVersion.VERSION_21
  targetCompatibility = JavaVersion.VERSION_21
}
`
);
w(
  'gradle/java17-toolchain/build.gradle.kts',
  `plugins { java }
java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(17)
    }
}
`
);
w(
  'gradle/springboot-java17/build.gradle',
  `plugins {
  id 'java'
  id 'org.springframework.boot' version '3.3.0'
}
java { sourceCompatibility = JavaVersion.VERSION_17 }
`
);
w(
  'gradle/war/build.gradle',
  `plugins {
  id 'war'
}
sourceCompatibility = '17'
`
);
w(
  'gradle/library/build.gradle',
  `plugins { id 'java-library' }
sourceCompatibility = '11'
`
);
w(
  'gradle/multimodule/settings.gradle',
  `rootProject.name = 'multi'
include 'api', 'core'
`
);
w(
  'gradle/multimodule/build.gradle',
  `subprojects {
  apply plugin: 'java'
  sourceCompatibility = '17'
}
`
);
w(
  'gradle/wrapper-project/build.gradle',
  `plugins { id 'java' }
sourceCompatibility = JavaVersion.VERSION_17
`
);
w('gradle/wrapper-project/gradlew', '#!/bin/sh\necho gradlew\n');
w(
  'gradle/wrapper-project/gradle/wrapper/gradle-wrapper.properties',
  'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.7-bin.zip\n'
);
w('gradle/kts-settings/settings.gradle.kts', 'rootProject.name = "kts"\n');
w(
  'gradle/kts-settings/build.gradle.kts',
  `plugins { java }
java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}
`
);

w('package-json/javascript-plain/package.json', pkg({ name: 'plain', version: '1.0.0' }));
w(
  'package-json/javascript-express/package.json',
  pkg({
    name: 'ex',
    version: '1.0.0',
    dependencies: { express: '^4.19.0' },
    engines: { node: '20.11.0' }
  })
);
w('package-json/javascript-express/package-lock.json', pkg({ name: 'ex', lockfileVersion: 3 }));
w(
  'package-json/typescript-react/package.json',
  pkg({
    name: 'ts-react',
    version: '1.0.0',
    dependencies: { react: '^18.0.0' },
    devDependencies: { typescript: '^5.0.0' }
  })
);
w('package-json/typescript-react/tsconfig.json', pkg({ compilerOptions: { strict: true } }));
w(
  'package-json/nextjs/package.json',
  pkg({ name: 'next-app', version: '1.0.0', dependencies: { next: '14.2.0', react: '18.2.0' } })
);
w('package-json/nextjs/package-lock.json', pkg({ lockfileVersion: 3 }));
w(
  'package-json/nestjs/package.json',
  pkg({ name: 'nest', version: '1.0.0', dependencies: { '@nestjs/core': '^10.0.0' } })
);
w('package-json/nestjs/yarn.lock', '# yarn lockfile v1\n');
w(
  'package-json/angular/package.json',
  pkg({ name: 'ng', version: '1.0.0', dependencies: { '@angular/core': '^17.0.0' } })
);
w('package-json/angular/pnpm-lock.yaml', 'lockfileVersion: "9.0"\n');
w('package-json/vue/package.json', pkg({ name: 'vue-app', version: '1.0.0', dependencies: { vue: '^3.4.0' } }));
w('package-json/vue/npm-shrinkwrap.json', pkg({ lockfileVersion: 3 }));
w('package-json/node-from-nvmrc/package.json', pkg({ name: 'nvm', version: '1.0.0' }));
w('package-json/node-from-nvmrc/.nvmrc', '18.20.0\n');
w('package-json/node-from-node-version/package.json', pkg({ name: 'nv', version: '1.0.0' }));
w('package-json/node-from-node-version/.node-version', 'v22.5.0\n');
w(
  'package-json/engines-priority/package.json',
  pkg({ name: 'prio', version: '1.0.0', engines: { node: '>=20.10.0' } })
);
w('package-json/engines-priority/.nvmrc', '18.0.0\n');
w('package-json/no-lock/package.json', pkg({ name: 'nolock', version: '1.0.0', dependencies: { express: '4.0.0' } }));

const csproj = (body) => `${body.trim()}\n`;

w(
  'dotnet/net6-console.csproj',
  csproj(`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net6.0</TargetFramework>
  </PropertyGroup>
</Project>`)
);
w(
  'dotnet/net8-console.csproj',
  csproj(`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
</Project>`)
);
w(
  'dotnet/net8-webapi.csproj',
  csproj(`<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
</Project>`)
);
w(
  'dotnet/net9-webapi.csproj',
  csproj(`<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
  </PropertyGroup>
</Project>`)
);
w(
  'dotnet/net10-webapi.csproj',
  csproj(`<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
  </PropertyGroup>
</Project>`)
);
w(
  'dotnet/net7-console.csproj',
  csproj(`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net7.0</TargetFramework>
  </PropertyGroup>
</Project>`)
);
w(
  'dotnet/net48.csproj',
  csproj(`<Project ToolsVersion="15.0">
  <PropertyGroup>
    <TargetFrameworkVersion>v4.8</TargetFrameworkVersion>
    <OutputType>Library</OutputType>
  </PropertyGroup>
</Project>`)
);
w(
  'dotnet/aspnet-core.csproj',
  csproj(`<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.App" />
  </ItemGroup>
</Project>`)
);
w(
  'dotnet/blazor-wasm.csproj',
  csproj(`<Project Sdk="Microsoft.NET.Sdk.BlazorWebAssembly">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Components.WebAssembly" Version="8.0.0" />
  </ItemGroup>
</Project>`)
);
w(
  'dotnet/azure-functions.csproj',
  csproj(`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <AzureFunctionsVersion>v4</AzureFunctionsVersion>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Sdk.Functions" Version="4.0.0" />
  </ItemGroup>
</Project>`)
);
w(
  'dotnet/test-project.csproj',
  csproj(`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.0.0" />
    <PackageReference Include="xunit" Version="2.4.0" />
  </ItemGroup>
</Project>`)
);
w(
  'dotnet/vbnet.vbproj',
  csproj(`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
</Project>`)
);
w(
  'dotnet/winforms.csproj',
  csproj(`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <UseWindowsForms>true</UseWindowsForms>
  </PropertyGroup>
</Project>`)
);
w(
  'dotnet/wpf.csproj',
  csproj(`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <UseWPF>true</UseWPF>
  </PropertyGroup>
</Project>`)
);
w(
  'dotnet/multi-tfm.csproj',
  csproj(`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>net6.0;net8.0</TargetFrameworks>
  </PropertyGroup>
</Project>`)
);
w(
  'dotnet/class-library.csproj',
  csproj(`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <OutputType>Library</OutputType>
  </PropertyGroup>
</Project>`)
);

const map = {
  'net6-console': 'net6-console.csproj',
  'net8-console': 'net8-console.csproj',
  'net8-webapi': 'net8-webapi.csproj',
  'net9-webapi': 'net9-webapi.csproj',
  'net10-webapi': 'net10-webapi.csproj',
  'net7-console': 'net7-console.csproj',
  net48: 'net48.csproj',
  'aspnet-core': 'aspnet-core.csproj',
  'blazor-wasm': 'blazor-wasm.csproj',
  'azure-functions': 'azure-functions.csproj',
  vbnet: 'vbnet.vbproj',
  winforms: 'winforms.csproj',
  wpf: 'wpf.csproj',
  'multi-tfm': 'multi-tfm.csproj',
  'class-library': 'class-library.csproj'
};

for (const [dir, file] of Object.entries(map)) {
  w(`dotnet-projects/${dir}/${file}`, fs.readFileSync(path.join(root, 'dotnet', file), 'utf8'));
}
w(
  'dotnet-projects/app-with-test/App.csproj',
  fs.readFileSync(path.join(root, 'dotnet', 'net8-console.csproj'), 'utf8')
);
w(
  'dotnet-projects/app-with-test/App.Tests.csproj',
  fs.readFileSync(path.join(root, 'dotnet', 'test-project.csproj'), 'utf8')
);

w(
  'configs/valid-config.json',
  pkg({
    schemaVersion: 1,
    repository: 'org/app',
    discovery: { language: 'java', buildSystem: 'maven', confidence: 'HIGH', runtimeVersion: '17' },
    builder: { strategy: 'BUILD_REQUIRED' },
    fingerprint: { algorithm: 'sha256', value: 'abc123' },
    dependencies: { requiredEnvironmentVariables: ['MAVEN_TOKEN'] }
  })
);
w('configs/incomplete-config.json', pkg({ schemaVersion: 1, repository: 'org/app' }));
w(
  'configs/future-schema.json',
  pkg({
    schemaVersion: 99,
    repository: 'org/app',
    discovery: {},
    builder: {},
    fingerprint: { value: 'x' }
  })
);

console.log('Unit fixtures generated at', root);
