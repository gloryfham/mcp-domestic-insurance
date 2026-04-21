import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================
// 数据加载
// ============================================================

const rawData = JSON.parse(
  readFileSync(join(__dirname, '..', 'data', 'domestic-products.json'), 'utf-8')
);

// 按 productCode 建立索引
const productMap = {};
rawData.forEach(p => {
  productMap[p.productCode] = p;
});

// ============================================================
// 关键词匹配函数
// ============================================================

function matchesKeyword(product, keyword) {
  if (!keyword) return true;
  const kw = keyword.toLowerCase();
  return (
    (product.productFullName || '').toLowerCase().includes(kw) ||
    (product.productShortName || '').toLowerCase().includes(kw) ||
    (product.companyShortName || '').toLowerCase().includes(kw) ||
    (product.productListPageIntroduction || '').toLowerCase().includes(kw) ||
    (product.brandShortName || '').toLowerCase().includes(kw)
  );
}

// ============================================================
// MCP Server 定义
// ============================================================

const server = new McpServer({
  name: 'glory-mcp-domestic-insurance',
  version: '1.0.0',
});

// ---------- 工具 1: 列出所有产品 ----------

server.tool(
  'listDomesticProducts',
  '获取所有国内保险产品列表（含互联网+线下渠道）',
  {
    channel: z.enum(['internet', 'offline', 'all']).optional().default('all').describe('渠道筛选: internet=互联网, offline=线下, all=全部'),
  },
  async ({ channel = 'all' }) => {
    let products = rawData;
    if (channel !== 'all') {
      products = rawData.filter(p => p.channel === channel);
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(products, null, 2) }],
    };
  }
);

// ---------- 工具 2: 搜索产品 ----------

server.tool(
  'searchDomesticProducts',
  '按条件搜索国内保险产品',
  {
    keyword: z.string().optional().describe('搜索关键词，支持产品名称、公司名、产品简介模糊匹配'),
    productType: z.string().optional().describe('产品类型代码筛选，如 P01/P04/P13 等'),
    channel: z.enum(['internet', 'offline']).optional().describe('渠道筛选: internet=互联网, offline=线下'),
    company: z.string().optional().describe('保险公司筛选，如 平安健康/中英人寿/太保寿'),
    hotLabel: z.string().optional().describe('热门标签筛选，如 H01/H04'),
  },
  async ({ keyword, productType, channel, company, hotLabel }) => {
    const result = rawData.filter(p => {
      // 关键词匹配
      if (!matchesKeyword(p, keyword)) return false;
      
      // 产品类型匹配
      if (productType && !p.productTypeCodeList?.includes(productType)) return false;
      
      // 渠道匹配
      if (channel && p.channel !== channel) return false;
      
      // 公司匹配
      if (company && !(p.companyShortName || '').includes(company)) return false;
      
      // 热门标签匹配
      if (hotLabel && !p.hotLabelList?.includes(hotLabel)) return false;
      
      return true;
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------- 工具 3: 获取产品详情 ----------

server.tool(
  'getDomesticProductDetail',
  '根据产品编号获取国内保险产品的完整详细信息',
  {
    productCode: z.string().describe('产品编号，如 AM100000588/179403/NQF'),
  },
  async ({ productCode }) => {
    const detail = productMap[productCode];
    if (!detail) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `未找到国内保险产品: ${productCode}` }) }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(detail, null, 2) }],
    };
  }
);

// ---------- 工具 4: 获取分类体系 ----------

server.tool(
  'getDomesticProductCategories',
  '获取国内保险产品分类体系（产品类型/热门标签/保险公司/渠道）',
  {},
  async () => {
    // 统计产品类型
    const productTypeMap = {};
    rawData.forEach(p => {
      (p.productTypeCodeList || []).forEach(type => {
        if (!productTypeMap[type]) {
          productTypeMap[type] = { code: type, count: 0, examples: [] };
        }
        productTypeMap[type].count++;
        if (productTypeMap[type].examples.length < 2) {
          productTypeMap[type].examples.push(p.productShortName || p.productFullName);
        }
      });
    });

    // 统计热门标签
    const hotLabelMap = {};
    rawData.forEach(p => {
      (p.hotLabelList || []).forEach(label => {
        if (!hotLabelMap[label]) {
          hotLabelMap[label] = { code: label, count: 0 };
        }
        hotLabelMap[label].count++;
      });
    });

    // 统计保险公司
    const companyMap = {};
    rawData.forEach(p => {
      const code = p.companyCode;
      if (!companyMap[code]) {
        companyMap[code] = {
          code: code,
          name: p.companyShortName || p.brandShortName,
          productCount: 0,
        };
      }
      companyMap[code].productCount++;
    });

    // 统计渠道
    const channelStats = {
      internet: { channel: 'internet', label: '互联网渠道', count: 0 },
      offline: { channel: 'offline', label: '线下渠道', count: 0 },
    };
    rawData.forEach(p => {
      if (channelStats[p.channel]) {
        channelStats[p.channel].count++;
      }
    });

    const result = {
      productTypes: Object.values(productTypeMap).sort((a, b) => a.code.localeCompare(b.code)),
      hotLabels: Object.values(hotLabelMap).sort((a, b) => a.code.localeCompare(b.code)),
      companies: Object.values(companyMap).sort((a, b) => a.name.localeCompare(b.name, 'zh')),
      channels: Object.values(channelStats),
      totalProducts: rawData.length,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ============================================================
// 启动
// ============================================================

export async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Glory Domestic Insurance MCP Server running on stdio');
}

main().catch(console.error);
