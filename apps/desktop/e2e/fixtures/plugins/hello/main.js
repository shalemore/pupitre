// A classic script, as the host page loads third-party plugins. The host builds the context; the
// plugin only names what it offers.
globalThis["__pupitreRegister"]({
  commands: [
    {
      id: "insert",
      title: { en: "Insert Greeting", "zh-CN": "插入问候" },
      async run(context) {
        await context.document.insert("Hello from the plugin");
      },
    },
  ],
  async activate(context) {
    await context.storage.set("started", true);
  },
});
