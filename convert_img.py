from PIL import Image, ImageOps

def convert_to_bw(input_path, output_path):
    try:
        # Open image
        img = Image.open(input_path).convert('RGB')
        
        # Convert to Grayscale
        gray = ImageOps.grayscale(img)
        
        # Apply Threshold to make it strict 1-bit Black and White
        # Threshold at 128
        bw = gray.point(lambda x: 0 if x < 128 else 255, '1')
        
        # Save
        bw.save(output_path)
        print(f"Successfully converted {input_path} to {output_path}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    convert_to_bw("alert.png", "alert_bw.png")
