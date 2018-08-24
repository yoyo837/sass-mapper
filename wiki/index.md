## 安装

```shell
npm i @no-repeat/sass-mapper -g
```

本模块依赖sass，安装sass请参考 [sass官方安装文档](https://sass-lang.com/install)

## API

在 Node 端, 可以调用 `mapper` 函数来生成变量映射表:

```
const mapper = require('@no-repeat/sass-mapper')

// 入口文件在文件系统中
//
// 参数1: 入口 SCSS 文件
// 参数2: 组件变量名的前缀, 如 $btn, $badge, etc.
await mapper('/path/to/entry/scss', '$var-prefix')

// 入口文件在内存中
//
// 参数1: 入口 SCSS 索引
// 参数2: 文件映射表
// 参数2: 组件变量名的前缀, 如 $btn, $badge, etc.
await mapper('index.scss', sources, '$var-prefix')
```

## 原理

变量追踪是为了实现, 针对任意组件的任意元素, 在只知道其 DOM 结构和 CSS 样式的情况下, 推测出其使用的 SCSS 变量, 从而实现配置指定元素样式的能力.

映射表生成:

1. 将源 SCSS 文件合并成单个 SCSS (single-scss)
2. 将 single-scss 进行 mixin 编译, 打平所有的 mixin, 生成新的 SCSS (no-mixin-scss)
3. 解析 no-mixin-scss 生成 AST (scss-ast), 遍历得到 SCSS 变量表 (scss-var-map)
4. 编译 no-mixin-scss, 生成 css 和 map 文件
5. 解析 css 生成 AST (css-ast), 通过遍历 css-ast 和 map, 得到 SCSS 到 CSS 规则的映射表 (scss-css-map)
6. 根据 scss-var-map 和 scss-css-map, 生成 SCSS 变量与 CSS 规则的映射表 (var-rules-map)

追踪流程:

1. 点击任意组件元素, 获取该元素的匹配的原始 CSS 规则 (css-rule)
2. 对 css-rule 的规则进行评分, 然后合并规则, 生成最终单个规则表 single-css-rule
3. 根据 var-rules-map 对 single-css-rule 进行映射, 获取对应的 scss-vars