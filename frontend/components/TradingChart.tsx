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
      attributionLogo: false,
    },

    grid: {
      vertLines: { color: 'rgba(39, 39, 42, 0.2)' },
      horzLines: { color: 'rgba(39, 39, 42, 0.2)' },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        width: 1 as any,
        color: 'rgba(255, 255, 255, 0.3)',
        style: 3, // dashed
        labelBackgroundColor: '#18181b',
      },
      horzLine: {
        width: 1 as any,
        color: 'rgba(255, 255, 255, 0.3)',
        style: 3,
        labelBackgroundColor: '#18181b',
      },
    },
    rightPriceScale: {
      borderColor: 'rgba(39, 39, 42, 0.4)',
      autoScale: true,
    },
    timeScale: {
      borderColor: 'rgba(39, 39, 42, 0.4)',
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 5,
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
        const t = Math.floor(new Date(d.time).getTime() / 1000);
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

  // Tooltip Logic
  useEffect(() => {
    if (!chartRef.current || !chartContainerRef.current) return;

    // Create a generic tooltip DIV if not exists
    let tooltip = document.getElementById('chart-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'chart-tooltip';
      tooltip.style.position = 'absolute';
      tooltip.style.display = 'none';
      tooltip.style.padding = '8px';
      tooltip.style.boxSizing = 'border-box';
      tooltip.style.fontSize = '12px';
      tooltip.style.textAlign = 'left';
      tooltip.style.zIndex = '1000';
      tooltip.style.top = '12px';
      tooltip.style.left = '12px';
      tooltip.style.pointerEvents = 'none';
      tooltip.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      tooltip.style.borderRadius = '8px';
      tooltip.style.fontFamily = "'Inter', sans-serif";
      tooltip.style.background = 'rgba(20, 20, 25, 0.85)';
      tooltip.style.color = '#fff';
      tooltip.style.backdropFilter = 'blur(4px)';
      chartContainerRef.current.appendChild(tooltip);
    }

    const updateTooltip = (param: any) => {
      if (!param || !param.time || param.point.x < 0 || param.point.x > chartContainerRef.current!.clientWidth || param.point.y < 0 || param.point.y > chartContainerRef.current!.clientHeight) {
        tooltip!.style.display = 'none';
        return;
      }

      if (seriesRef.current) {
        const data = param.seriesData.get(seriesRef.current);
        if (data) {
          const { open, high, low, close } = data as any;
          const color = close >= open ? '#10b981' : '#ef4444';
          tooltip!.innerHTML = `
            <div style="font-weight:bold; margin-bottom:4px;">AckiMeme</div>
            <div style="color: rgba(255,255,255,0.7)">
              O <span style="color:${color}">${open.toFixed(6)}</span><br/>
              H <span style="color:${color}">${high.toFixed(6)}</span><br/>
              L <span style="color:${color}">${low.toFixed(6)}</span><br/>
              C <span style="color:${color}">${close.toFixed(6)}</span>
            </div>
          `;
          tooltip!.style.display = 'block';
        }
      }
    };

    chartRef.current.subscribeCrosshairMove(updateTooltip);

    return () => {
      if (chartRef.current) chartRef.current.unsubscribeCrosshairMove(updateTooltip);
      if (tooltip) tooltip.remove();
    };
  }, [chartRef.current, history]);

  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--line)', position: 'relative' }}>
      <div ref={chartContainerRef} style={{ width: '100%', height: '320px', position: 'relative' }} />
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
