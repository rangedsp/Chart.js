'use strict';

module.exports = function(Chart) {

	var helpers = Chart.helpers;

	var defaultConfig = {
		position: 'left',

		// label settings
		ticks: {
			callback: Chart.Ticks.formatters.logarithmic
		}
	};

	var LogarithmicScale = Chart.Scale.extend({
		constructor: function() {
			var me = this;

			// Properties for backwards compatibility
			Object.defineProperty(me, 'min', {
				get: function() {
					return me.dataRange ? me.dataRange.min : NaN;
				}
			});
			Object.defineProperty(me, 'minNotZero', {
				get: function() {
					return me.dataRange ? me.dataRange.minNotZero : NaN;
				}
			});
			Object.defineProperty(me, 'max', {
				get: function() {
					return me.dataRange ? me.dataRange.max : NaN;
				}
			});

			return Chart.Scale.apply(me, arguments);
		},
		determineDataLimits: function() {
			var me = this;
			var opts = me.options;
			var tickOpts = opts.ticks;
			var chart = me.chart;
			var data = chart.data;
			var datasets = data.datasets;
			var getValueOrDefault = helpers.getValueOrDefault;
			var isHorizontal = me.isHorizontal();
			function IDMatches(meta) {
				return isHorizontal ? meta.xAxisID === me.id : meta.yAxisID === me.id;
			}

			// Calculate Range
			var dataRange = me.dataRange = {
				min: null,
				max: null,
				minNotZero: null
			};

			if (opts.stacked) {
				var valuesPerType = {};

				helpers.each(datasets, function(dataset, datasetIndex) {
					var meta = chart.getDatasetMeta(datasetIndex);
					if (chart.isDatasetVisible(datasetIndex) && IDMatches(meta)) {
						if (valuesPerType[meta.type] === undefined) {
							valuesPerType[meta.type] = [];
						}

						helpers.each(dataset.data, function(rawValue, index) {
							var values = valuesPerType[meta.type];
							var value = +me.getRightValue(rawValue);
							if (isNaN(value) || meta.data[index].hidden) {
								return;
							}

							values[index] = values[index] || 0;

							if (opts.relativePoints) {
								values[index] = 100;
							} else {
								// Don't need to split positive and negative since the log scale can't handle a 0 crossing
								values[index] += value;
							}
						});
					}
				});

				helpers.each(valuesPerType, function(valuesForType) {
					var minVal = helpers.min(valuesForType);
					var maxVal = helpers.max(valuesForType);
					dataRange.min = dataRange.min === null ? minVal : Math.min(dataRange.min, minVal);
					dataRange.max = dataRange.max === null ? maxVal : Math.max(dataRange.max, maxVal);
				});

			} else {
				helpers.each(datasets, function(dataset, datasetIndex) {
					var meta = chart.getDatasetMeta(datasetIndex);
					if (chart.isDatasetVisible(datasetIndex) && IDMatches(meta)) {
						helpers.each(dataset.data, function(rawValue, index) {
							var value = +me.getRightValue(rawValue);
							if (isNaN(value) || meta.data[index].hidden) {
								return;
							}

							if (dataRange.min === null) {
								dataRange.min = value;
							} else if (value < dataRange.min) {
								dataRange.min = value;
							}

							if (dataRange.max === null) {
								dataRange.max = value;
							} else if (value > dataRange.max) {
								dataRange.max = value;
							}

							if (value !== 0 && (dataRange.minNotZero === null || value < dataRange.minNotZero)) {
								dataRange.minNotZero = value;
							}
						});
					}
				});
			}

			dataRange.min = getValueOrDefault(tickOpts.min, dataRange.min);
			dataRange.max = getValueOrDefault(tickOpts.max, dataRange.max);

			if (dataRange.min === dataRange.max) {
				if (dataRange.min !== 0 && dataRange.min !== null) {
					dataRange.min = Math.pow(10, Math.floor(helpers.log10(dataRange.min)) - 1);
					dataRange.max = Math.pow(10, Math.floor(helpers.log10(dataRange.max)) + 1);
				} else {
					dataRange.min = 1;
					dataRange.max = 10;
				}
			}
		},
		buildTicks: function() {
			var me = this;
			var opts = me.options;
			var tickOpts = opts.ticks;
			var dataRange = me.dataRange;

			var generationOptions = {
				min: tickOpts.min,
				max: tickOpts.max
			};
			var ticks = me.ticks = Chart.Ticks.generators.logarithmic(generationOptions, dataRange);

			if (!me.isHorizontal()) {
				// We are in a vertical orientation. The top value is the highest. So reverse the array
				ticks.reverse();
			}

			// At this point, we need to update our max and min given the tick values since we have expanded the
			// range of the scale
			dataRange.min = helpers.min(ticks);
			dataRange.max = helpers.max(ticks);

			if (tickOpts.reverse) {
				ticks.reverse();

				me.start = dataRange.max;
				me.end = dataRange.min;
			} else {
				me.start = dataRange.min;
				me.end = dataRange.max;
			}
		},
		convertTicksToLabels: function() {
			this.tickValues = this.ticks.slice();

			Chart.Scale.prototype.convertTicksToLabels.call(this);
		},
		// Get the correct tooltip label
		getLabelForIndex: function(index, datasetIndex) {
			return +this.getRightValue(this.chart.data.datasets[datasetIndex].data[index]);
		},
		getPixelForTick: function(index) {
			return this.getPixelForValue(this.tickValues[index]);
		},
		getPixelForValue: function(value) {
			var me = this;
			var innerDimension;
			var pixel;

			var start = me.start;
			var newVal = +me.getRightValue(value);
			var range;
			var paddingTop = me.paddingTop;
			var paddingBottom = me.paddingBottom;
			var paddingLeft = me.paddingLeft;
			var opts = me.options;
			var tickOpts = opts.ticks;
			var dataRange = me.dataRange;

			if (me.isHorizontal()) {
				range = helpers.log10(me.end) - helpers.log10(start); // todo: if start === 0
				if (newVal === 0) {
					pixel = me.left + paddingLeft;
				} else {
					innerDimension = me.width - (paddingLeft + me.paddingRight);
					pixel = me.left + (innerDimension / range * (helpers.log10(newVal) - helpers.log10(start)));
					pixel += paddingLeft;
				}
			} else {
				// Bottom - top since pixels increase downard on a screen
				innerDimension = me.height - (paddingTop + paddingBottom);
				if (start === 0 && !tickOpts.reverse) {
					range = helpers.log10(me.end) - helpers.log10(dataRange.minNotZero);
					if (newVal === start) {
						pixel = me.bottom - paddingBottom;
					} else if (newVal === dataRange.minNotZero) {
						pixel = me.bottom - paddingBottom - innerDimension * 0.02;
					} else {
						pixel = me.bottom - paddingBottom - innerDimension * 0.02 - (innerDimension * 0.98/ range * (helpers.log10(newVal)-helpers.log10(dataRange.minNotZero)));
					}
				} else if (me.end === 0 && tickOpts.reverse) {
					range = helpers.log10(me.start) - helpers.log10(dataRange.minNotZero);
					if (newVal === me.end) {
						pixel = me.top + paddingTop;
					} else if (newVal === dataRange.minNotZero) {
						pixel = me.top + paddingTop + innerDimension * 0.02;
					} else {
						pixel = me.top + paddingTop + innerDimension * 0.02 + (innerDimension * 0.98/ range * (helpers.log10(newVal)-helpers.log10(dataRange.minNotZero)));
					}
				} else {
					range = helpers.log10(me.end) - helpers.log10(start);
					innerDimension = me.height - (paddingTop + paddingBottom);
					pixel = (me.bottom - paddingBottom) - (innerDimension / range * (helpers.log10(newVal) - helpers.log10(start)));
				}
			}
			return pixel;
		},
		getValueForPixel: function(pixel) {
			var me = this;
			var range = helpers.log10(me.end) - helpers.log10(me.start);
			var value, innerDimension;

			if (me.isHorizontal()) {
				innerDimension = me.width - (me.paddingLeft + me.paddingRight);
				value = me.start * Math.pow(10, (pixel - me.left - me.paddingLeft) * range / innerDimension);
			} else {  // todo: if start === 0
				innerDimension = me.height - (me.paddingTop + me.paddingBottom);
				value = Math.pow(10, (me.bottom - me.paddingBottom - pixel) * range / innerDimension) / me.start;
			}
			return value;
		}
	});
	Chart.scaleService.registerScaleType('logarithmic', LogarithmicScale, defaultConfig);

};
