import { StrategyOnlineOptions , OnlineResult , 
    makeError , CoreErrorCode , 
    SendOptions , SendResult , 
    OfflineResult , 
    StrategyRestartOptions , RestartResult,
    StateCode , StateResult
} from "@core/plugin-sdk";

let state = {
    online: false
}

export = {

    /** 
     * 插件上線，options內包含method字段，表明使用哪種方法上線（local或remote），以及其他相關配置
     * @param {StrategyOnlineOptions} options - 上線選項，必須包含method字段  
     * @returns {Promise<OnlineResult<void>>} 上線結果，包含狀態碼和可選的錯誤信息
     *
    */
    async online(options: StrategyOnlineOptions): Promise<OnlineResult<void>> {
        try {

            console.log("system example plugin online with options:", options);
            state.online = true;

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
            console.log("system example plugin offline");
            state.online = false;
            return { ok: true, value: undefined };
        }catch (error) {
            return { ok: false, error: makeError(CoreErrorCode.OFFLINE_FAILED, "offline failed", error) };
        }
    },

    /**
     * 插件重啟，輸入參數和online方法一樣，包含method字段和其他相關配置
     * @param {StrategyRestartOptions} options - 重啟選項，必須包含method字段
     * @returns {RestartResult<void>} 重啟結果，包含狀態碼和可選的錯誤信息
     */
    async restart(options: StrategyRestartOptions): Promise<RestartResult<void>> {
        try {
    
            await this.offline();
            
            await this.online(options);

            console.log("system example plugin restart with options:", options);

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
        return { ok: true, value: { status : state.online ? 1 : 0 } };
    },

    async send(options: SendOptions) : Promise<SendResult<void>>{
        try {

            console.log("system example plugin send with options:", options);

            return { ok: true, value: undefined };

        } catch (error) {
            return { ok: false, error: makeError(CoreErrorCode.RUNNING_FAILED, "send failed", error) };
        }
    }

}
