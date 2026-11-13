# Másters de imagen

PNG originales de las ilustraciones del personaje (1080×1080). La landing publica sus versiones WebP
(`public/images/personaje/*.webp`, calidad 84), unas diez veces más livianas. Para regenerarlas:

```bash
node -e "const s=require(\"sharp\");for(const f of [\"frontal\",\"izquierda\",\"lateral\",\"posterior\"])s(\"originales-imagen/personaje/\"+f+\".png\").webp({quality:84,alphaQuality:90,effort:6}).toFile(\"public/images/personaje/\"+f+\".webp\")"
```
