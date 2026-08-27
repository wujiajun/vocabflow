@echo off
setlocal
set MAVEN_VERSION=3.9.11
set BASE_DIR=%~dp0
set MAVEN_DIR=%BASE_DIR%.mvn\wrapper\apache-maven-%MAVEN_VERSION%
if not exist "%MAVEN_DIR%\bin\mvn.cmd" powershell -Command "Invoke-WebRequest https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/%MAVEN_VERSION%/apache-maven-%MAVEN_VERSION%-bin.zip -OutFile '%BASE_DIR%.mvn\wrapper\maven.zip'; Expand-Archive '%BASE_DIR%.mvn\wrapper\maven.zip' '%BASE_DIR%.mvn\wrapper'"
call "%MAVEN_DIR%\bin\mvn.cmd" %*
