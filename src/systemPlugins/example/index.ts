import { OnlineOptions , OnlineResult , 
    makeError , CoreErrorCode , 
    SendOptions , SendResult , 
    OfflineResult , 
    RestartOptions , RestartResult,
    StateCode , StateResult
} from "@core/plugin-sdk";

import strategies from "./strategies";

let mode: "local" | "remote" = "local"; // 預設使用 local 策略  

export = {

    /** 
     * 插件上線，options內包含method字段，表明使用哪種方法上線（local或remote），以及其他相關配置
     * @param {OnlineOptions} options - 上線選項，必須包含method字段  
     * @returns {Promise<OnlineResult<void>>} 上線結果，包含狀態碼和可選的錯誤信息
     *
    */
    async online(options: OnlineOptions): Promise<OnlineResult<void>> {
        try {

            if (!options.method) {
                console.error("online options missing method");
                throw "options missing method";
            }

            await strategies[options.method].online(options);

            mode = options.method; // 記錄當前使用的策略

            return { ok: true, value: undefined };

        } catch (error) {
            return { ok: false, error: makeError(CoreErrorCode.ONLINE_FAILED, "online failed", error) };
        }
    },

    /** 
     * 插件下線，沒有輸入參數
     * @returns {Promise<OfflineResult<void>>} 下線結果，包含狀態碼和可選的錯誤信息
     * 
    */
    async offline(): Promise<OfflineResult<void>> {
        try {
            
            await strategies[mode].offline();

            return { ok: true, value: undefined };
        }catch (error) {
            return { ok: false, error: makeError(CoreErrorCode.OFFLINE_FAILED, "offline failed", error) };
        }
    },

    /**
     * 插件重啟，輸入參數和online方法一樣，包含method字段和其他相關配置
     * @param {RestartOptions} options - 重啟選項，必須包含method字段
     * @returns {RestartResult<void>} 重啟結果，包含狀態碼和可選的錯誤信息
     */
    async restart(options: RestartOptions): Promise<RestartResult<void>> {
        try {

            if (!options.method) {
                console.error("restart options missing method");
                throw "options missing method";
            }
    
            await strategies[options.method].restart(options);

            console.log("system plugin restarted with method:", options.method);

            mode = options.method; // 更新當前使用的策略

            return { ok: true, value: undefined };

        }catch (error) {
            return { ok: false, error: makeError(CoreErrorCode.RESTART_FAILED, "restart failed", error) };
        }
    },

    /**
     * 獲取插件狀態，沒有輸入參數
     * @returns {Promise<{ status: StateCode }>} 狀態結果，包含狀態碼
     */
    async state() : Promise<StateResult<{ status: StateCode }>> {
        return await strategies[mode].state();
    },

    async send(options: SendOptions) : Promise<SendResult<void>>{
        try {

            return await strategies[mode].send(options);

        } catch (error) {
            return { ok: false, error: makeError(CoreErrorCode.RUNNING_FAILED, "send failed", error) };
        }
    }

}
