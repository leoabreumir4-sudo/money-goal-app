import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Line, Pie, Bar } from 'recharts';
import { LineChart, PieChart, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Cell } from 'recharts';
import { useMemo } from 'react';

// Colors for charts
const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

interface AIMessageProps {
  content: string;
}

// Parse chart markers in AI response
function parseChartData(marker: string): { type: string; data: any } | null {
  const match = marker.match(/\[CHART:([\w_]+)\s+data=({.*?})\]/);
  if (!match) return null;
  
  try {
    const type = match[1];
    const data = JSON.parse(match[2]);
    return { type, data };
  } catch {
    return null;
  }
}

// Render inline chart based on type
function InlineChart({ type, data }: { type: string; data: any }) {
  if (type === 'line_graph' || type === 'savings_projection') {
    return (
      <div className="my-4 p-4 bg-secondary/50 rounded-lg">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data.values || data}>
            <XAxis dataKey="label" stroke="#888" />
            <YAxis stroke="#888" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
              labelStyle={{ color: '#fff' }}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }
  
  if (type === 'pie_chart' || type === 'category_breakdown') {
    return (
      <div className="my-4 p-4 bg-secondary/50 rounded-lg">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label
            >
              {data.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }
  
  if (type === 'bar_chart' || type === 'monthly_comparison') {
    return (
      <div className="my-4 p-4 bg-secondary/50 rounded-lg">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <XAxis dataKey="label" stroke="#888" />
            <YAxis stroke="#888" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
            />
            <Bar dataKey="value" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
  
  if (type === 'progress_bar') {
    const percentage = Math.min(100, Math.max(0, data.percentage || 0));
    return (
      <div className="my-4 p-4 bg-secondary/50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{data.label || 'Progress'}</span>
          <span className="text-sm text-muted-foreground">{percentage}%</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-3">
          <div 
            className="bg-primary h-3 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
        {data.subtitle && (
          <p className="text-xs text-muted-foreground mt-2">{data.subtitle}</p>
        )}
      </div>
    );
  }
  
  return null;
}

export default function AIMessage({ content }: AIMessageProps) {
  // Parse content for charts
  const contentParts = useMemo(() => {
    const parts: Array<{ type: 'text' | 'chart'; content: string; chartData?: any }> = [];
    const chartRegex = /\[CHART:[\w_]+\s+data={.*?}\]/g;
    
    let lastIndex = 0;
    let match;
    
    while ((match = chartRegex.exec(content)) !== null) {
      // Add text before chart
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.substring(lastIndex, match.index)
        });
      }
      
      // Add chart
      const chartData = parseChartData(match[0]);
      if (chartData) {
        parts.push({
          type: 'chart',
          content: match[0],
          chartData
        });
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex)
      });
    }
    
    return parts.length > 0 ? parts : [{ type: 'text' as const, content }];
  }, [content]);
  
  return (
    <div className="prose prose-invert max-w-none">
      {contentParts.map((part, index) => {
        if (part.type === 'chart' && part.chartData) {
          return (
            <InlineChart 
              key={index}
              type={part.chartData.type}
              data={part.chartData.data}
            />
          );
        }
        
        return (
          <ReactMarkdown
            key={index}
            remarkPlugins={[remarkGfm]}
            components={{
              // Custom styling for markdown elements
              h1: ({ children }) => <h1 className="text-2xl font-bold mt-4 mb-2">{children}</h1>,
              h2: ({ children }) => <h2 className="text-xl font-bold mt-3 mb-2">{children}</h2>,
              h3: ({ children }) => <h3 className="text-lg font-semibold mt-2 mb-1">{children}</h3>,
              p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="ml-2">{children}</li>,
              strong: ({ children }) => <strong className="font-bold text-primary">{children}</strong>,
              em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
              code: ({ children }) => (
                <code className="px-1.5 py-0.5 bg-secondary rounded text-sm font-mono">{children}</code>
              ),
              pre: ({ children }) => (
                <pre className="p-3 bg-secondary rounded-lg overflow-x-auto my-2">{children}</pre>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-primary pl-4 italic my-2">{children}</blockquote>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto my-4">
                  <table className="min-w-full border-collapse">{children}</table>
                </div>
              ),
              thead: ({ children }) => <thead className="bg-secondary">{children}</thead>,
              tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
              tr: ({ children }) => <tr>{children}</tr>,
              th: ({ children }) => (
                <th className="px-4 py-2 text-left font-semibold">{children}</th>
              ),
              td: ({ children }) => <td className="px-4 py-2">{children}</td>,
            }}
          >
            {part.content}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}
