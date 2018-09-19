import * as React from "react";
import { TorrentDataProvider, IndexType } from "./load";
import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
/*import Highcharts from "highcharts/js/es-modules/parts/Globals";
import "highcharts/js/es-modules/parts/Chart";
import "highcharts/js/es-modules/parts/SvgRenderer";
import "highcharts/js/es-modules/parts/ScatterSeries";
import "highcharts/js/es-modules/parts/PlotLineOrBand";
import "highcharts/js/es-modules/parts/Interaction";
import "highcharts/css/highcharts.scss";*/

import { observable, computed } from "mobx";
import { observer } from "mobx-react";
import { chartOptions } from "./render";
import { fromPromise, lazyObservable } from "mobx-utils";
import AsyncSelect from "react-select/lib/Async";
import TrieSearch from "trie-search";
import { imdbproto } from "../lib/ratings";

type P = { data: TorrentDataProvider; initialSeries: string[] };

const minSearchLength = 2;
@observer
export default class Gui extends React.Component<P> {
	@observable
	seriesNames: string[] = [];

	options: TrieSearch | null = null;
	constructor(p: P) {
		super(p);
		this.seriesNames = p.initialSeries;
	}

	@computed
	get currentSeriesData() {
		return fromPromise(
			(async () => {
				if (this.seriesNames.length === 0) return null;
				console.log("fetching", this.seriesNames.slice());
				const series = await Promise.all(this.seriesNames.map(name => this.props.data.getSeriesInfo(name)));
				console.log("got series data", series);
				return chartOptions(series.filter((s): s is imdbproto.DB.ISeries => !!s));
			})()
		);
	}

	loading: Promise<IndexType[]> | null = null;
	getOptions = async (filter: string) => {
		if (!this.options) {
			if (this.loading) await this.loading;
			else {
				this.loading = this.props.data.getNames();
				const ret = await this.loading;
				this.options = new TrieSearch("title", {
					min: minSearchLength
				});
				this.options.addAll(ret.map(([title, priority]) => ({ title, priority })));
			}
		}
		if (filter.length < minSearchLength) {
			// infinitely waiting promise
			return new Promise(() => {});
		}
		return this.options
			.get(filter)
			.sort((a, b) => b.priority - a.priority)
			.map(p => p.title)
			.slice(0, 100);
	};
	render() {
		return (
			<>
				{this.currentSeriesData.case({
					pending: () => <>Loading...</>,
					fulfilled: options =>
						options ? <HighchartsReact highcharts={Highcharts} options={options} /> : <>Empty</>,
					rejected: e => {
						console.error(e);
						return <>Error: {e.toString()}</>;
					}
				})}
				<AsyncSelect<string>
					loadOptions={this.getOptions}
					getOptionLabel={o => o}
					getOptionValue={o => o}
					placeholder="Enter series name..."
					value={this.seriesNames}
					// defaultOptions={true}
					isMulti
					onChange={o => (this.seriesNames = o as string[])}
				/>
				<footer>
					<p>
						<a href="https://github.com/phiresky/tv-show-ratings">Source on GitHub</a>
					</p>
				</footer>
			</>
		);
	}
}
