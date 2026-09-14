// host node:test 入口：注册包别名 loader，使 node:test 能直接运行 host TS 单测。
import { register } from 'node:module';

register('./host-alias-loader.mjs', import.meta.url);
