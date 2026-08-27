// node --import 入口：注册包别名 loader，使 node:test 能直接运行 shared TS 单测。
import { register } from 'node:module';

register('./module-alias-loader.mjs', import.meta.url);
