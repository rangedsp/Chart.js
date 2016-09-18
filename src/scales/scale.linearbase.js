'use strict';

module.exports = function(Chart) {

	var helpers = Chart.helpers,
		noop = helpers.noop;

	Chart.LinearScaleBase = Chart.Scale.extend({
		// Following http://www.erichynds.com/blog/backbone-and-inheritance
		constructor: function() {
			// These two properties kept for backwards compatibility
			var me = this;
			Object.defineProperty(me, 'min', {
				get: function() {
					return me.dataRange ? me.dataRange.min : NaN;
				}
			});

			Object.defineProperty(me, 'max', {
				get: function() {
					return me.dataRange ? me.dataRange.max : NaN;
				}
			});

			// Call the base constructor
			return Chart.Scale.apply(me, arguments);
		},

		handleTickRangeOptions: function() {
			var me = this;
			var opts = me.options;
			var tickOpts = opts.ticks;
			var dataRange = me.dataRange;

			// If we are forcing it to begin at 0, but 0 will already be rendered on the chart,
			// do nothing since that would make the chart weird. If the user really wants a weird chart
			// axis, they can manually override it
			if (tickOpts.beginAtZero) {
				var minSign = helpers.sign(dataRange.min);
				var maxSign = helpers.sign(dataRange.max);

				if (minSign < 0 && maxSign < 0) {
					// move the top up to 0
					dataRange.max = 0;
				} else if (minSign > 0 && maxSign > 0) {
					// move the botttom down to 0
					dataRange.min = 0;
				}
			}

			if (tickOpts.min !== undefined) {
				dataRange.min = tickOpts.min;
			} else if (tickOpts.suggestedMin !== undefined) {
				dataRange.min = Math.min(dataRange.min, tickOpts.suggestedMin);
			}

			if (tickOpts.max !== undefined) {
				dataRange.max = tickOpts.max;
			} else if (tickOpts.suggestedMax !== undefined) {
				dataRange.max = Math.max(dataRange.max, tickOpts.suggestedMax);
			}

			if (dataRange.min === dataRange.max) {
				dataRange.max++;

				if (!tickOpts.beginAtZero) {
					dataRange.min--;
				}
			}
		},
		getTickLimit: noop,
		handleDirectionalChanges: noop,

		buildTicks: function() {
			var me = this;
			var opts = me.options;
			var tickOpts = opts.ticks;
			var dataRange = me.dataRange;

			// Figure out what the max number of ticks we can support it is based on the size of
			// the axis area. For now, we say that the minimum tick spacing in pixels must be 50
			// We also limit the maximum number of ticks to 11 which gives a nice 10 squares on
			// the graph. Make sure we always have at least 2 ticks
			var maxTicks = me.getTickLimit();
			maxTicks = Math.max(2, maxTicks);

			var numericGeneratorOptions = {
				maxTicks: maxTicks,
				min: tickOpts.min,
				max: tickOpts.max,
				stepSize: helpers.getValueOrDefault(tickOpts.fixedStepSize, tickOpts.stepSize)
			};
			var ticks = me.ticks = Chart.Ticks.generators.linear(numericGeneratorOptions, dataRange);

			me.handleDirectionalChanges();

			// At this point, we need to update our max and min given the tick values since we have expanded the
			// range of the scale
			dataRange.max = helpers.max(ticks);
			dataRange.min = helpers.min(ticks);

			if (tickOpts.reverse) {
				ticks.reverse();

				me.start = me.max;
				me.end = me.min;
			} else {
				me.start = me.min;
				me.end = me.max;
			}
		},
		convertTicksToLabels: function() {
			var me = this;
			me.ticksAsNumbers = me.ticks.slice();
			me.zeroLineIndex = me.ticks.indexOf(0);

			Chart.Scale.prototype.convertTicksToLabels.call(me);
		}
	});
};
