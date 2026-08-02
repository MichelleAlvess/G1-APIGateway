@echo off
echo ===================================================
echo   DEPLOY DO FRONTEND ESTÁTICO PARA O AMAZON S3
echo ===================================================
echo.
set /p BUCKET_NAME="Digite o nome do seu bucket S3 na AWS: "

if "%BUCKET_NAME%"=="" (
    echo [ERRO] O nome do bucket nao pode ser vazio.
    pause
    exit /b 1
)

echo.
echo [1/3] Habilitando hospedagem estatica no S3...
aws s3 website s3://%BUCKET_NAME%/ --index-document index.html --error-document index.html

echo.
echo [2/3] Enviando arquivos do Frontend para s3://%BUCKET_NAME%/ ...
aws s3 sync . s3://%BUCKET_NAME%/ --exclude "*.bat" --exclude "aws-s3-policy.json" --exclude "cors-config.json" --acl public-read

echo.
echo [3/3] Deploy concluido com sucesso!
echo.
echo Seu site esta online em:
echo http://%BUCKET_NAME%.s3-website-us-east-1.amazonaws.com
echo.
pause
