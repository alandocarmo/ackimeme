import React, { useEffect, useRef, useMemo } from 'react';
import { createChart, ColorType, CrosshairMode, IChartApi, ISeriesApi, CandlestickSeries } from 'lightweight-charts';
import { useChart } from '../hooks/useChart';

export interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface TradingChartProps {
  history: CandlestickData[];
}

export function TradingChart({ history }: TradingChartProps): React.JSX.Element {
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  
  const chartOptions = useMemo(() => ({
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: '#a1a1aa', // var(--ink-soft)
    },
    grid: {
      vertLines: { color: 'rgba(39, 39, 42, 0.4)' },
      horzLines: { color: 'rgba(39, 39, 42, 0.4)' },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
    },
    rightPriceScale: {
      borderColor: 'rgba(39, 39, 42, 0.4)',
    },
    timeScale: {
      borderColor: 'rgba(39, 39, 42, 0.4)',
      timeVisible: true,
      secondsVisible: false,
    },
  }), []);

  const { chartContainerRef, chartRef } = useChart(chartOptions);

  useEffect(() => {
    if (!chartRef.current) return;

    const series = chartRef.current.addSeries(CandlestickSeries, {
      upColor: '#00ff88', // var(--accent)
      downColor: '#ff4757', // var(--red)
      borderVisible: false,
      wickUpColor: '#00ff88',
      wickDownColor: '#ff4757',
    });
    seriesRef.current = series as any;

    return () => {
      chartRef.current?.removeSeries(series);
    };
  }, [chartRef.current]);

  useEffect(() => {
    if (seriesRef.current && history && history.length > 0) {
      // lightweight-charts expects time in seconds if it's a timestamp
      // Assuming our history.time is ms or seconds. Let's make sure it's in seconds.
      const formattedData = history.map(d => {
        // if time is in ms (typically > 1e11), convert to seconds. 
        // lightweight-charts requires time in seconds or string format.
        let t = d.time;
        if (t > 1e11) {
            t = Math.floor(t / 1000);
        }
        return {
          time: t as any,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        };
      });
      // lightweight-charts requires data to be sorted by time
      formattedData.sort((a, b) => a.time - b.time);
      
      seriesRef.current.setData(formattedData);
      chartRef.current?.timeScale().fitContent();
    }
  }, [history]);

  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--line)', position: 'relative' }}>
      <div ref={chartContainerRef} style={{ width: '100%', height: '320px' }} />
      {(!history || history.length === 0) && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg)', color: 'var(--ink-soft)', zIndex: 10 }}>
          <ChartEmptyState />
        </div>
      )}
    </div>
  );
}

function ChartEmptyState() {
  const { useI18n } = require('../lib/i18n');
  const { t } = useI18n();
  return <>{t('chart_no_history')}</>;
}
