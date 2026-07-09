# Aqua Insight - MLOps Pipeline Script
# Petunjuk Penggunaan (Google Colab / Local environment):
# 1. Pastikan Anda menginstal ultralytics (YOLOv8) dan tensorflowjs.
#    !pip install ultralytics tensorflowjs
# 2. Skrip ini melatih model YOLOv8 ringan (nano) dan mengekspornya ke format TensorFlow.js.

from ultralytics import YOLO
import os
import shutil

# --- KONFIGURASI ---
# Ganti dengan path ke file data.yaml dataset mikroskop Anda.
# Format dataset YOLO: direktori images/ dan labels/
DATASET_YAML_PATH = "dataset/data.yaml"

# Jumlah siklus pelatihan (epochs). Untuk uji coba gunakan 10-20. 
# Untuk hasil produksi gunakan 100-300.
EPOCHS = 100 

# Nama model output
MODEL_NAME = "aqua_insight_yolov8n"

def main():
    print("🚀 Memulai Pelatihan Model (Aqua Insight MLOps)")
    print("-------------------------------------------------")
    
    # Memuat model dasar YOLOv8 ukuran 'nano' (sangat ringan, cocok untuk browser/laptop)
    print("[1/3] Memuat model arsitektur dasar (YOLOv8 nano)...")
    model = YOLO("yolov8n.pt") 
    
    # Mulai Pelatihan
    print(f"\n[2/3] Memulai proses training selama {EPOCHS} epochs menggunakan {DATASET_YAML_PATH}...")
    try:
        results = model.train(
            data=DATASET_YAML_PATH,
            epochs=EPOCHS,
            imgsz=640,
            batch=16,
            name=MODEL_NAME
        )
    except Exception as e:
        print(f"❌ Error saat training: {e}")
        print("💡 Pastikan format dataset data.yaml sudah benar dan terhubung dengan path images/labels.")
        return

    # Ekspor ke TensorFlow.js
    print("\n[3/3] Mengekspor model terbaik ke format TensorFlow.js (web-friendly)...")
    
    # Path model terbaik hasil training
    best_model_path = f"runs/detect/{MODEL_NAME}/weights/best.pt"
    
    if os.path.exists(best_model_path):
        best_model = YOLO(best_model_path)
        
        # Ekspor format TFJS
        # Parameter int8=True atau half=True dapat digunakan untuk kuantisasi (memperkecil ukuran model)
        export_path = best_model.export(format="tfjs", optimize=True)
        print(f"✅ Ekspor sukses! Model TFJS disimpan di: {export_path}")
        print("\n📥 Langkah Selanjutnya:")
        print(f"Unduh folder {export_path} dan masukkan ke dalam folder 'aqua-insight/models/'.")
        print("Di dalam file plankton-analysis.js, ubah 'cocoSsd.load()' menjadi:")
        print("tf.loadGraphModel('../models/best_web_model/model.json')")
    else:
        print(f"❌ Gagal mengekspor: File {best_model_path} tidak ditemukan.")

if __name__ == "__main__":
    main()
