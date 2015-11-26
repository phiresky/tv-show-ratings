node ../node_modules/protobufjs/bin/pbjs ratings.proto > ../bin/ratings.json
node ../node_modules/proto2typescript/bin/proto2typescript-bin.js -f ratings.json > ../lib/ratings.d.ts
