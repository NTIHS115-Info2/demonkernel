import fs from "node:fs";
import path from "node:path";

class PluginsManager {

    skillPluginsPath: string;
    systemPluginsPath: string;

    // 插件列表 (插件名稱 : 插件實例)
    skillPlugins: Map<string, object> = new Map();
    systemPlugins: Map<string, object> = new Map();

    constructor() {

        this.skillPluginsPath = path.resolve(__dirname, ".." , "skillPlugins");
        this.systemPluginsPath = path.resolve(__dirname, ".." , "systemPlugins");



    }

    /**
     * 
     * @param pluginDir 
     */
    private scanPluginDirectory(
        basePath: string, 
        targetMap : Map<string, object>
    ) {
        const pluginDirs = fs.readdirSync(basePath, { withFileTypes: true });

        for (const dirent of pluginDirs) {
            if (!dirent.isDirectory()) continue;

            const pluginName = dirent.name;
            const pluginPath = path.join(basePath, pluginName , "index.js");

            if (!fs.existsSync(pluginPath)) {
                console.warn(`[PluginsManager] 插件 ${pluginName} 缺少 index.js 文件`);
                continue;
            }

            const pluginsModule = require(pluginPath);

            targetMap.set(pluginName, pluginsModule);
        }
    }

    /**
     * 掃描兩個插件目錄，+
     * 
     */ 
    scanPlugins() {
        
        this.scanPluginDirectory(this.skillPluginsPath, this.skillPlugins);
        this.scanPluginDirectory(this.systemPluginsPath, this.systemPlugins);

        for (const pluginName of this.skillPlugins.keys()) {
            console.log(`[PluginsManager] 已加载技能插件: ${pluginName}`);
        }

        for (const pluginName of this.systemPlugins.keys()) {
            console.log(`[PluginsManager] 已加载系统插件: ${pluginName}`);
        }

    }


};

export default new PluginsManager();