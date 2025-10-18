var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var MONITORING_URL = "https://monitoring.meteo.uz/ru/map/view/724";
async function fetchAirQualityData() {
  try {
    const response = await fetch(MONITORING_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const html = await response.text();
    const pm25Match = html.match(/PM 2\.5:.*?(\d+\.?\d*)/);
    const pm10Match = html.match(/PM 10:.*?(\d+\.?\d*)/);
    if (!pm25Match || !pm10Match) {
      console.log("HTML content preview:", html.substring(0, 1e3));
      throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043D\u0430\u0439\u0442\u0438 \u0434\u0430\u043D\u043D\u044B\u0435 PM 2.5 \u0438\u043B\u0438 PM 10");
    }
    const pm25 = parseFloat(pm25Match[1]);
    const pm10 = parseFloat(pm10Match[1]);
    return {
      PM25: pm25,
      PM10: pm10,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u0438 \u0434\u0430\u043D\u043D\u044B\u0445:", error);
    return null;
  }
}
__name(fetchAirQualityData, "fetchAirQualityData");
function getAirQualityLevel(pm25, pm10) {
  if (pm25 <= 12 && pm10 <= 54) {
    return ["\u0425\u043E\u0440\u043E\u0448\u043E", "\u{1F7E2}"];
  } else if (pm25 <= 35.4 && pm10 <= 154) {
    return ["\u0423\u043C\u0435\u0440\u0435\u043D\u043D\u043E", "\u{1F7E1}"];
  } else if (pm25 <= 55.4 && pm10 <= 254) {
    return ["\u0412\u0440\u0435\u0434\u043D\u043E \u0434\u043B\u044F \u0447\u0443\u0432\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0445", "\u{1F7E0}"];
  } else if (pm25 <= 150.4 && pm10 <= 354) {
    return ["\u0412\u0440\u0435\u0434\u043D\u043E", "\u{1F534}"];
  } else if (pm25 <= 250.4 && pm10 <= 424) {
    return ["\u041E\u0447\u0435\u043D\u044C \u0432\u0440\u0435\u0434\u043D\u043E", "\u{1F7E3}"];
  } else {
    return ["\u041E\u043F\u0430\u0441\u043D\u043E", "\u{1F7E4}"];
  }
}
__name(getAirQualityLevel, "getAirQualityLevel");
function getChangeEmoji(current, previous) {
  if (previous === null || previous === void 0) {
    return "";
  }
  if (current > previous) {
    return " \u{1F53C}";
  } else if (current < previous) {
    return " \u{1F53D}";
  } else {
    return " \u23FA\uFE0F";
  }
}
__name(getChangeEmoji, "getChangeEmoji");
async function sendTelegramMessage(message, botToken, chatId) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML"
      })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return true;
  } catch (error) {
    console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0435 \u0432 Telegram:", error);
    return false;
  }
}
__name(sendTelegramMessage, "sendTelegramMessage");
function formatMessage(currentData, previousData) {
  const pm25 = currentData.PM25;
  const pm10 = currentData.PM10;
  const [qualityLevel, qualityEmoji] = getAirQualityLevel(pm25, pm10);
  const pm25Emoji = getChangeEmoji(pm25, previousData?.PM25);
  const pm10Emoji = getChangeEmoji(pm10, previousData?.PM10);
  const timestamp = (/* @__PURE__ */ new Date()).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  return `PM 2.5: ${pm25.toFixed(3)}${pm25Emoji} | PM 10: ${pm10.toFixed(3)}${pm10Emoji}

${qualityLevel} ${qualityEmoji}
\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E: ${timestamp}`;
}
__name(formatMessage, "formatMessage");
var worker_default = {
  async scheduled(event, env, ctx) {
    const currentData = await fetchAirQualityData();
    if (!currentData) {
      console.log("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0435");
      return;
    }
    const previousData = await env.AIR_DATA.get("previous", "json");
    const threshold = 5;
    let shouldNotify = false;
    if (!previousData) {
      shouldNotify = true;
      console.log("\u041F\u0435\u0440\u0432\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A - \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u043C \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435");
    } else {
      const pm25Changed = Math.abs(currentData.PM25 - previousData.PM25) > threshold;
      const pm10Changed = Math.abs(currentData.PM10 - previousData.PM10) > threshold;
      if (pm25Changed || pm10Changed) {
        shouldNotify = true;
        console.log("\u041E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u044B \u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F - \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u043C \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435");
      } else {
        console.log("\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043D\u0435\u0437\u043D\u0430\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 - \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435 \u043D\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u043C");
      }
    }
    if (shouldNotify) {
      const message = formatMessage(currentData, previousData);
      const success = await sendTelegramMessage(
        message,
        env.TELEGRAM_BOT_TOKEN,
        env.TELEGRAM_CHAT_ID
      );
      if (success) {
        console.log("\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E \u0443\u0441\u043F\u0435\u0448\u043D\u043E");
      } else {
        console.log("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0435 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F");
      }
    }
    await env.AIR_DATA.put("previous", JSON.stringify(currentData));
    console.log("\u0414\u0430\u043D\u043D\u044B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B");
  }
};

// ../../../../opt/homebrew/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../opt/homebrew/lib/node_modules/wrangler/templates/middleware/middleware-scheduled.ts
var scheduled = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  const url = new URL(request.url);
  if (url.pathname === "/__scheduled") {
    const cron = url.searchParams.get("cron") ?? "";
    await middlewareCtx.dispatch("scheduled", { cron });
    return new Response("Ran scheduled event");
  }
  const resp = await middlewareCtx.next(request, env);
  if (request.headers.get("referer")?.endsWith("/__scheduled") && url.pathname === "/favicon.ico" && resp.status === 500) {
    return new Response(null, { status: 404 });
  }
  return resp;
}, "scheduled");
var middleware_scheduled_default = scheduled;

// ../../../../opt/homebrew/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-7K2YQ6/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_scheduled_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../../opt/homebrew/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-7K2YQ6/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
