import os
import argparse
from ultralytics import YOLO

def export_model(weights_path, output_dir):
    """
    Ekspor model Ultralytics YOLOv8 (.pt) ke format TensorFlow.js
    agar bisa dijalankan langsung di browser (Edge Inference).
    """
    if not os.path.exists(weights_path):
        print(f"[ERROR] File bobot {weights_path} tidak ditemukan.")
        return

    print(f"[INFO] Memuat model YOLOv8 dari {weights_path}...")
    model = YOLO(weights_path)
    
    print("[INFO] Memulai proses ekspor ke format tfjs...")
    # 'tfjs' format converts the model into a web-friendly GraphModel
    export_path = model.export(format="tfjs", imgsz=640)
    
    print(f"[SUCCESS] Model berhasil diekspor ke direktori: {export_path}")
    print("Silakan pindahkan isi direktori tersebut (model.json dan file .bin)")
    print("ke direktori proyek: assets/models/yolo/<nama_model>/")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export YOLOv8 to TFJS for Aqua Insight")
    parser.add_argument("--weights", type=str, required=True, help="Path ke file YOLOv8 .pt (misal: best.pt)")
    parser.add_argument("--out", type=str, default=".", help="Direktori output")
    
    args = parser.parse_args()
    
    # Pastikan direktori mlops ada
    os.makedirs(args.out, exist_ok=True)
    
    export_model(args.weights, args.out)
