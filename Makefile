all: bin/client.js bin/index.html bin/libs.js bin/libs.css


bin/parse.js: src/parse.ts lib/ratings.d.ts
	tsc

bin/render.js: src/render.ts lib/ratings.d.ts
	tsc

bin/basedata-popular.buf: bin/parse.js data/ratings-series.list
	node bin/parse.js

bin/ratings-series.list: bin/ratings.list
	bin/preprocess.sh

bin/libs.js:
	paste -s node_modules/jquery/dist/jquery.min.js \
	lib/highcharts.js \
	node_modules/bytebuffer/dist/bytebuffer.min.js \
	node_modules/protobufjs/dist/protobuf-light.min.js \
	lib/autocomplete-0.3.0.min.js \
	> bin/libs.js

bin/libs.css:
	paste -s lib/autocomplete-0.3.0.min.css \
	> bin/libs.css
	
bin/client.js: bin/render.js bin/ratings.json
	(echo '_schema = '; cat bin/ratings.json; cat bin/render.js) > bin/client.js

bin/ratings.json: src/ratings.proto
	node node_modules/protobufjs/bin/pbjs src/ratings.proto > bin/ratings.json

lib/ratings.d.ts: bin/ratings.json
	node node_modules/proto2typescript/bin/proto2typescript-bin.js -f bin/ratings.json > lib/ratings.d.ts

bin/index.html: src/index.html
	cp $< bin
