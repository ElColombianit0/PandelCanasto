import multer from "multer";

/* PRODUCTOS */

const storageProductos = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/productos");
  },

  filename: function (req, file, cb) {
    const unique =
      Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(null, unique + "-" + file.originalname);
  },
});

export const uploadProducto = multer({
  storage: storageProductos,
});

/* BANNERS */

const storageBanner = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/banners");
  },

  filename: function (req, file, cb) {
    const unique =
      Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(null, unique + "-" + file.originalname);
  },
});

export const uploadBanner = multer({
  storage: storageBanner,
});
