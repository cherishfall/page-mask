import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    // 名称 / 描述 / 按钮提示走多语言包 public/_locales/{en,zh_CN}/messages.json（#28）。
    // 商店的名称与简短说明只能来自这里，控制台不可单独填写。
    default_locale: 'en',
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    homepage_url: 'https://github.com/cherishfall/page-mask',
    // 各 API 的起始版本核实见 docs/dev/DEVLOG.md「#28」一节；硬下限 114（Popover），留余量取 116。
    minimum_chrome_version: '116',
    // 四个尺寸均由 scripts/gen-icons.mjs 从 assets/icon/*.svg 生成；路径不带前导斜杠。
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    action: {
      default_title: '__MSG_actionTitle__',
      default_icon: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    },
    permissions: ['storage', 'scripting', 'activeTab'],
    optional_host_permissions: ['*://*/*'],
  },
  hooks: {
    // WXT 会把 popup/index.html 的 <title> 写成 action.default_title，覆盖上面的配置
    // （<title> 优先于 meta manifest.default_title）。生成 manifest 后再改回多语言占位。
    'build:manifestGenerated': (_wxt, manifest) => {
      if (manifest.action) manifest.action.default_title = '__MSG_actionTitle__';
      // 内容脚本只靠后台按站点动态注册（ADR-0001/0002）。entrypoints/content.ts 为了让 WXT 构建出
      // content-scripts/content.js 写了一个占位 matches，这里把它从 manifest 删掉：
      // 否则安装时会提示"读取和更改您在 pagemask.invalid 上的数据"（REVIEW B11）。
      // 不用 registration:'runtime'：WXT 会把它的 matches 写进 host_permissions，同样产生安装提示。
      // scripts/check-package.mjs 校验产物 manifest 里没有 content_scripts / host_permissions。
      delete manifest.content_scripts;
    },
  },
});
