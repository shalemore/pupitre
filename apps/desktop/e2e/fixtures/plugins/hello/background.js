globalThis["__pupitreSurfaceRegister"]({
  setup({ canvas, size, onResize }) {
    // The host clears the canvas when it resizes, so the drawing is redone at its new size
    const draw = () => {
      const context = canvas.getContext("2d");
      context.fillStyle = "rgb(255, 204, 0)";
      context.fillRect(0, 0, size().width, size().height);
    };
    draw();
    onResize(draw);
  },
});
