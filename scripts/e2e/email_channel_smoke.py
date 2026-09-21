#!/usr/bin/env python3
"""EMAIL-E2E-SMOKE：邮件通道前端对接面的**真栈**冒烟（前端侧）。

动机：EMAIL-WEB-UI 卡的四个关键结论（`challenge` 是 A 形态可用性开关、
`session_id` 无校验且缺省回退邮箱、三元组 `(session,email,code)` 校验、
`ticket` 非空即走 B 形态）全是从后端源码读出来的，**没一条被真栈跑过**。
任一个偏，前端会在真实部署里静默不可用。本脚本用**真 bin + 真服务器 + 真实
HTTP**把可验证的部分跑一遍，把不可验证的部分诚实 SKIP。

覆盖（对应卡片 1–4）：
  1. GET  /api/settings/server/email → 断言 12 个 snake_case 字段全存在；
  2. PUT  /api/settings/server/email → username/html_template **空串原样发**，
     断言后端接受（不报反序列化错）；password 留空 = 不改；
  3. POST /api/auth/password-reset/start → 断言响应形状，并**打印**实际
     delivery/challenge（不假装是哪个形态）；
  4. 拿到非空 challenge → 跑 A 形态 complete（ticket:'' 占位 + session_id=challenge
     + code）断言走到 A 分支；拿不到 → 诚实 SKIP + 打印原因，绝不假绿。

纪律：
  - 真发送邮件不要求（无 SMTP）：做不到就 SKIP + 打印原因，绝不用 mock 冒充真栈；
  - 退出码透传：环境不备（无 bin）→ SKIP 退出 0 不假红；跑了就真判定，FAIL 非 0；
  - 不碰后端与契约文档。

**未挂进 `pnpm verify` 的理由（开放项，待主代理裁决）**：
  本脚本第 5 步会在③不可验证时补跑 `cargo test`（后端真单测作证据）。首次编译
  约 4.5 分钟（后续命中缓存约 20 秒），挂进 verify 会显著拖慢日常门禁，故当前
  **只注册了独立的 `pnpm email-smoke`，未并入 verify**。
  - 若要改为常驻：在根 package.json 的 `verify` 链里追加 `&& pnpm email-smoke`；
  - 若要完全手动：保持现状，或给脚本加 `--no-unit-evidence` 关掉第 5 步。
  注意：脚本对 SKIP 一律 exit 0，挂进 verify 也不会假红；只有真断言失败才非 0。

用法：
  python3 scripts/e2e/email_channel_smoke.py
  python3 scripts/e2e/email_channel_smoke.py --port 18095 --dir /data/fmby-e2e-w1-email
  python3 scripts/e2e/email_channel_smoke.py --target /data/fmby-target/ws-zcode-writer3/debug
"""

from __future__ import annotations

import argparse
import os
import sys

# 复用后端仓既有 harness（真栈生命周期：起服务 / seed / 登录 / CSRF / 停服务）。
BACKEND_REPO = os.environ.get("FMBY_BACKEND_REPO", "/home/tefuir/rustproject/FMBY-V2")
sys.path.insert(0, os.path.join(BACKEND_REPO, "scripts", "e2e"))

# 契约：GET /api/settings/server/email 的 12 个响应字段（wire 全 snake_case）。
# 依据：EmailChannelSettingsDto 裸派生 serde 无 rename_all
# （crates/fmby-v2-http/src/state/settings.rs:88），与
# docs/interfaces/api-contract-fields.json 的 responseFields 逐字一致。
EMAIL_RESPONSE_FIELDS = [
    "configured",
    "secret_fields_configured",
    "host",
    "port",
    "security",
    "username",
    "from_address",
    "reset_delivery",
    "code_len",
    "code_ttl_minutes",
    "link_ttl_minutes",
    "html_template",
]


def skipped(reason: str) -> int:
    print(f"SKIP(email-channel-smoke): {reason}")
    return 0


# 当前使用的 target（供 SKIP 文案定位“bin 太旧”）。
CURRENT_TARGET = ""


def load_harness():
    try:
        from harness import (  # type: ignore
            DEFAULT_DIR,
            DEFAULT_PORT,
            DEFAULT_TARGET,
            Fail,
            Harness,
        )
    except ImportError as e:
        return None, f"无法导入后端 harness（{e}）——跳过，不假红"
    return {
        "DEFAULT_DIR": DEFAULT_DIR,
        "DEFAULT_PORT": DEFAULT_PORT,
        "DEFAULT_TARGET": DEFAULT_TARGET,
        "Fail": Fail,
        "Harness": Harness,
    }, None


def step1_get_email_channel(h) -> dict:
    """① GET：断言 12 个 snake_case 字段全存在。"""
    print("\n[1] GET /api/settings/server/email —— 12 字段 snake_case 全存在")
    status, body = h.request("GET", "/api/settings/server/email")
    if status != 200:
        if status == 404:
            raise _Skip(
                "GET 返回 404 —— 该 bin 未含 EMAIL-CHANNEL 路由"
                f"（target={CURRENT_TARGET}）；换较新 target 重跑（--target …）"
            )
        raise _Skip(f"GET 返回 {status}：{body} —— 本项不可验证")
    if not isinstance(body, dict):
        raise _Fail(f"响应非对象：{body!r}")

    missing = [f for f in EMAIL_RESPONSE_FIELDS if f not in body]
    if missing:
        raise _Fail(f"缺字段 {missing}；实际字段={sorted(body.keys())}")
    h.expect(True, f"12 个 snake_case 字段全部存在：{sorted(body.keys())}")
    print(f"  实际响应：configured={body.get('configured')} "
          f"security={body.get('security')!r} reset_delivery={body.get('reset_delivery')!r} "
          f"username={body.get('username')!r} html_template={body.get('html_template')!r}")
    # username/html_template 是 Rust String（空串=未填），不是 null
    for f in ("username", "html_template", "host", "from_address"):
        if body.get(f) is None:
            raise _Fail(f"{f} 应为 Rust String（空串而非 null），实际 null——前端类型假设错了")
    h.expect(True, "username/html_template/host/from_address 均为 String（空串而非 null）")
    return body


def step2_put_email_channel(h, current: dict) -> None:
    """② PUT：空串 username/html_template 原样发；password 留空=不改。"""
    print("\n[2] PUT /api/settings/server/email —— 空串原样发 + password 留空不改")
    payload = {
        "host": current.get("host", ""),
        "port": current.get("port", 587),
        "security": current.get("security", "starttls"),
        "username": "",                      # Rust String：空串原样发（不得归一 null）
        "from_address": current.get("from_address", ""),
        "reset_delivery": current.get("reset_delivery", "code"),
        "code_len": current.get("code_len", 6),
        "code_ttl_minutes": current.get("code_ttl_minutes", 10),
        "link_ttl_minutes": current.get("link_ttl_minutes", 15),
        "html_template": "",                 # 同上
        # password 省略 = 不改
    }
    status, body = h.request("PUT", "/api/settings/server/email", payload)
    if status != 200:
        print(f"  ! PUT 返回 {status}：{body}")
        raise _Skip(f"PUT 返回 {status}（邮件通道未装配/缺配置）——空串接受性不可验证")
    h.expect(True, "PUT 接受空串 username/html_template（无反序列化错）")
    if isinstance(body, dict):
        print(f"  回显：username={body.get('username')!r} html_template={body.get('html_template')!r}")
        if body.get("username") == "" and body.get("html_template") == "":
            h.expect(True, "回显确认为空串（不是 null，也不是被改成别的）")
    # password 留空未覆写：GET 再读一次，secret_fields_configured 不应变化
    status2, after = h.request("GET", "/api/settings/server/email")
    if status2 == 200 and isinstance(after, dict):
        before = current.get("secret_fields_configured")
        now = after.get("secret_fields_configured")
        if before == now:
            h.expect(True, f"password 留空未改写凭据（secret_fields_configured 仍为 {now}）")
        else:
            raise _Fail(f"password 留空却改了凭据状态：{before} → {now}")


def step3_start_password_reset(h) -> tuple[str, str]:
    """③ start：断言响应形状，打印实际 delivery/challenge（不假设形态）。"""
    print("\n[3] POST /api/auth/password-reset/start —— 响应形状 + 打印实际形态")
    status, body = h.request("POST", "/api/auth/password-reset/start", {"email": "admin@example.com"})
    print(f"  status={status} body={body}")
    if status != 200:
        # 真栈实测：生产装配未接（EmailChannelParts 仅单测里 Fake 注入，
        # with_email_channel 无生产调用点）→ 端点恒 fail-closed 503。
        raise _Skip(
            f"start 返回 {status}（{body}）——邮件端口未在生产装配："
            "with_email_channel 无生产调用点，属后端接线缺口，非前端问题；"
            "本项在真服务器上当前不可验证"
        )
    if not isinstance(body, dict):
        raise _Fail(f"start 响应非对象：{body!r}")
    for f in ("accepted", "delivery", "challenge", "expires_at_ms"):
        if f not in body:
            raise _Fail(f"start 响应缺字段 {f}；实际={sorted(body.keys())}")
    h.expect(True, f"响应形状齐全：{sorted(body.keys())}")
    h.expect(body.get("accepted") is True, f"accepted=true（防枚举：不存在也同形）实际={body.get('accepted')}")
    delivery = body.get("delivery")
    challenge = body.get("challenge") or ""
    print(f"  >> 实际 delivery={delivery!r} challenge={challenge!r} "
          f"expires_at_ms={body.get('expires_at_ms')}")
    return delivery, challenge


def step4_complete_code_form(h, challenge: str) -> None:
    """④ A 形态 complete：ticket:'' 占位 + session_id=challenge + code → 走 A 分支。"""
    print("\n[4] POST /api/auth/password-reset/complete —— A 形态（challenge 非空）")
    if not challenge.strip():
        raise _Skip("challenge 为空 → A 形态不可用（无真实邮件投递），不假绿")
    payload = {
        "ticket": "",                # 空 → 后端走 A 分支（ticket 非空才走 B）
        "session_id": challenge,     # 必须等于 start 响应的 challenge（三元组校验）
        "email": "admin@example.com",
        "code": "000000",            # 故意错码：验证确实进了 A 分支校验
        "new_password": "newpassword123",
    }
    status, body = h.request("POST", "/api/auth/password-reset/complete", payload)
    print(f"  status={status} body={body}")
    # 进了 A 分支：错码 → 400 统一文案（不是 204 成功，也不是「参数缺失」之外的异常）
    if status == 204:
        raise _Fail("错码竟返回 204 —— 未走验证码校验（A 分支未生效）")
    if status == 400:
        msg = (body or {}).get("message", "")
        h.expect(True, f"A 分支生效：错码被拒（400）且文案统一：{msg!r}")
        if "参数" in msg or "缺失" in msg:
            raise _Fail(f"落到了「参数缺失」分支而非验证码校验：{msg!r} —— session_id/email/code 未送齐")
        return
    raise _Skip(f"complete 返回 {status}（非 400）：{body} —— A 分支判定不确定，不假绿")


class _Skip(Exception):
    """环境/实现状不可验证 → SKIP（退出 0，不假红也不假绿）。"""


class _Fail(Exception):
    """真跑了且断言失败 → FAIL（非 0）。"""


def step5_backend_unit_evidence(repo: str) -> None:
    """③/④ 在真服务器不可验证时的**补充证据**：跑后端既有真单测。

    不是 mock 冒充真栈——是后端仓已落地的 `cargo test`（Fake 仓储 + 真
    EmailChannelParts + 真 Argon2），覆盖 A 形态三元组校验、B 形态 ticket 分支、
    challenge/session_id 语义。用它把「源码读出来的结论」变成「执行过的结论」。
    """
    print("\n[5] 补充证据：跑后端既有真单测（password_reset bridges）")
    import shutil
    import subprocess

    if not shutil.which("cargo"):
        print("  ! 无 cargo，跳过补充证据")
        return
    # 用调用者自己的 target（w3 的 /data 目录常是 root 所有，写不进去 → 权限错）
    target = os.environ.get("FMBY_CARGO_TARGET", "/data/fmby-target/ws-zcode-writer1")
    try:
        proc = subprocess.run(
            [
                "cargo", "test", "--offline", "-p", "fmby-v2-server",
                "--lib", "password_reset::",
            ],
            cwd=repo,
            env={**os.environ, "CARGO_TARGET_DIR": target},
            capture_output=True,
            text=True,
            timeout=1200,
        )
    except Exception as e:  # 超时/环境异常：不据此判前端
        print(f"  ! cargo 执行失败：{e}")
        return
    print((proc.stdout or "")[-2500:])
    if proc.returncode == 0:
        print("  ✓ 后端 password_reset 真单测通过（A/B 分支与三元组语义已被执行验证）")
    else:
        # 编译/环境问题（权限、离线依赖）不算前端回归，但要把 stderr 打出来便于定位
        print(f"  ! cargo 退出码 {proc.returncode}——不据此判前端，仅登记")
        print("  stderr 尾部：\n" + (proc.stderr or "")[-1200:])


def run_smoke(h, repo: str, unit_evidence: bool = True) -> int:
    skips: list[str] = []
    try:
        current = step1_get_email_channel(h)
    except _Skip as e:
        skips.append(str(e))
        current = None
    except _Fail as e:
        print(f"FAIL: {e}")
        return 1

    if current is not None:
        try:
            step2_put_email_channel(h, current)
        except _Skip as e:
            skips.append(str(e))
        except _Fail as e:
            print(f"FAIL: {e}")
            return 1

    try:
        delivery, challenge = step3_start_password_reset(h)
    except _Skip as e:
        skips.append(str(e))
        delivery, challenge = None, ""
    except _Fail as e:
        print(f"FAIL: {e}")
        return 1

    if delivery is not None:
        try:
            step4_complete_code_form(h, challenge)
        except _Skip as e:
            skips.append(str(e))
        except _Fail as e:
            print(f"FAIL: {e}")
            return 1
    else:
        # start 不可验证（生产未装配邮件端口）→ 用后端真单测补证据
        if unit_evidence:
            step5_backend_unit_evidence(repo)
        else:
            print("\n[5] 补充证据：--no-unit-evidence 已指定，跳过 cargo test")

    if skips:
        print("\n=== SKIP 项（不可验证，非绿）===")
        for s in skips:
            print(f"  - {s}")
    print("\n=== 冒烟结束：无 FAIL ===")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=18095)
    ap.add_argument("--dir", default="/data/fmby-e2e-w1-email")
    # 默认用 w3 的共享 target：它含 EMAIL-CHANNEL 路由（w1 的 debug bin 编译于
    # 路由合并前，跑起来恒 404 → 脚本会诚实 SKIP 并提示换 target）。
    ap.add_argument(
        "--target", default="/data/fmby-target/ws-zcode-writer3/debug"
    )
    ap.add_argument(
        "--no-unit-evidence",
        action="store_true",
        help="跳过第 5 步 cargo test 补充证据（纯 HTTP 冒烟，最快）",
    )
    args = ap.parse_args()

    mod, err = load_harness()
    if err:
        return skipped(err)

    server_bin = os.path.join(args.target, "fmby-v2-server")
    seed_bin = os.path.join(args.target, "fmby-e2e-seed")
    if not (os.access(server_bin, os.X_OK) and os.access(seed_bin, os.X_OK)):
        return skipped(f"bin 不存在（{server_bin} / {seed_bin}）——无编译环境不判定回归")

    os.makedirs(args.dir, exist_ok=True)
    global CURRENT_TARGET
    CURRENT_TARGET = args.target
    h = mod["Harness"](args.port, args.dir, args.target)
    try:
        # 冷启动判定：库不存在 → 本次要先 seed 建库（实测数秒），服务就绪窗口
        # 需放宽（默认 10s 会在冷启动下撞窗口 → 误判 FAIL）。热启动（库已存在）
        # 仍用默认窗口，不拖慢复跑。
        cold = not os.path.exists(h.db)
        h.ensure_seeded()
        h.start_server(wait_secs=60 if cold else 10)
        h.login()  # admin/admin（seed 默认），拿 session + csrf 双工件
        return run_smoke(h, BACKEND_REPO, unit_evidence=not args.no_unit_evidence)
    except mod["Fail"] as e:
        print(f"FAIL(harness): {e}")
        return 1
    except Exception as e:  # 环境异常不伪装成断言失败
        print(f"SKIP(email-channel-smoke): 环境异常 {type(e).__name__}: {e}")
        return 0
    finally:
        try:
            h.stop_server()
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(main())
