'use strict';

/**
 * 高雄青職「活力同行」運行時全域常數配置
 * 支援三微服務架構 (Core, Chat, Progression)
 * 前端透過 Iframe Bridge + google.script.run 直連，免除跨域跳轉
 */
window.APP_RUNTIME_CONFIG = Object.freeze({
  // 三大微服務 GAS Web App /exec 網址
  coreGasWebAppUrl: 'https://script.google.com/macros/s/AKfycbwYA1qPfQLIubRVS0UwyWXufcsRQh_KxoLNUiaYbyM9kQ6DniLBDw5W1a1FakIRPExuuw/exec',
  chatGasWebAppUrl: 'https://script.google.com/macros/s/AKfycbx9w5Tv1m1fIC6e3NdyLzbZDQCMA_Lq8F53hdvHG6j2f3Elp2xQ9Sk0xF8UCNqhBYdJDw/exec',
  progressionGasWebAppUrl: 'https://script.google.com/macros/s/AKfycbyMlpjE_A1uQHrPrBsGQcBa1sLmK9Hlu5cfDqNhiyN13wQJe94MbquBC-_0m-8FNT0Mrw/exec',

  releaseVersion: 'v2.0.0-iframe-bridge'
});
