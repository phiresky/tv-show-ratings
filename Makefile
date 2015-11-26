all: bin/render.js bin/index.html bin/basedata-popular.buf.js


bin/parse.js: src/parse.ts lib/ratings.d.ts
	tsc

bin/render.js: src/render.ts lib/ratings.d.ts
	tsc

bin/basedata-popular.buf.js: bin/parse.js data/ratings-series.list bin/ratings.json
	node bin/parse.js

data/ratings.list:
	mkdir -p data
	wget ftp://ftp.fu-berlin.de/pub/misc/movies/database/ratings.list.gz -O data/ratings.list.gz
	gunzip data/ratings.list.gz

data/ratings-series.list: data/ratings.list
	iconv -f ISO-8859-1 -t utf8 data/ratings.list -o data/ratings-series.list
	# only series (title is in "")
	sed -r -i '/[0-9]\.[0-9]  ".*" \(/!d' data/ratings-series.list

bin/ratings.json: src/ratings.proto
	mkdir -p bin
	node node_modules/protobufjs/bin/pbjs src/ratings.proto > bin/ratings.json

lib/ratings.d.ts: bin/ratings.json
	mkdir -p bin
	node node_modules/proto2typescript/bin/proto2typescript-bin.js -f bin/ratings.json > lib/ratings.d.ts

bin/index.html: src/index.html
	mkdir -p bin
	php src/index.html > bin/index.html
