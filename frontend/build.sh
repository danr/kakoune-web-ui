#!/bin/sh
rm -rf dist
esbuild                                          \
    --bundle src/index.tsx                       \
    --outdir=dist                                \
    --target=es6                                 \
    "--define:process.env.NODE_ENV='production'" \
    --pure:console.log
cd dist
index_hash="main.$(md5sum index.js | head -c 10).js"
mv index.js "$index_hash"
sed 's,.*index.js.*,<script src="'"$index_hash"'"></script>,' < ../public/index.html > index.html
