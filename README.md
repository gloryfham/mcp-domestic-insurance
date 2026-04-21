# Glory Domestic Insurance MCP Server

国内保险产品查询 MCP 服务，提供 111 个国内保险产品（互联网 53 个 + 线下 58 个）的查询能力。

## 安装

```bash
npm install @gloryfham/mcp-domestic-insurance
```

## 使用

```bash
npx gloryfham-mcp-domestic-insurance
```

## 数据源

数据来自 `docs/data.json`，包含：
- 互联网渠道: 53 个产品
- 线下渠道: 58 个产品
- 总计: 111 个产品
- 保险公司: 31 家

## 更新数据

将新的 `data.json` 文件复制到 `data/domestic-products.json`，运行数据转换脚本即可。
