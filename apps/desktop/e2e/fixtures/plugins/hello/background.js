globalThis["__pupitreSurfaceRegister"]({
  setup({ canvas, size }) {
    const context = canvas.getContext("2d");
    context.fillStyle = "rgb(255, 204, 0)";
    context.fillRect(0, 0, size().width, size().height);
  },
});
