# コントリビューション / Contributing

Issue や PR は歓迎です。個人で運営している小さなプロジェクトなので、返信やマージに時間がかかることがあります。

- 大きな変更は、先に Issue で相談してください。
- UI は React コンポーネントで書きます（[AGENTS.md](./AGENTS.md)）。
- PR を出す前に、手元で次が通ることを確認してください。

  ```bash
  pnpm install
  pnpm check
  pnpm test
  pnpm test:browser   # 初回は pnpm exec playwright install --with-deps chromium webkit
  pnpm test:e2e
  ```

- 公式素材（[NOTICE.md](./NOTICE.md)）は MIT License の対象外です。差し替えや追加の PR は受け付けられません。
- 脆弱性は Issue ではなく [SECURITY.md](./SECURITY.md) の方法で報告してください。
- 送ってもらったコードは、このリポジトリと同じ [MIT License](./LICENSE) で公開されます。

---

Issues and pull requests are welcome. For larger changes, please open an issue first. Run `pnpm check`, `pnpm test`, `pnpm test:browser` and `pnpm test:e2e` before opening a PR. Official assets listed in [NOTICE.md](./NOTICE.md) are not covered by the MIT License, and PRs that add or replace them cannot be accepted. Report vulnerabilities as described in [SECURITY.md](./SECURITY.md). Contributions are licensed under the [MIT License](./LICENSE).
