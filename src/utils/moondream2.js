// https://huggingface.co/Xenova/moondream2

import { AutoProcessor, AutoTokenizer, Moondream1ForConditionalGeneration, RawImage } from '@huggingface/transformers';

export const modelId = 'Xenova/moondream2';

export async function loadMoondreamModel() {
    const processor = await AutoProcessor.from_pretrained(modelId);
    const tokenizer = await AutoTokenizer.from_pretrained(modelId);
    const model = await Moondream1ForConditionalGeneration.from_pretrained(modelId, {
        dtype: {
            embed_tokens: 'fp16',
            vision_encoder: 'fp16',
            decoder_model_merged: 'q4',
        },
        device: navigator.gpu ? 'webgpu' : 'wasm',
    });

    return { processor, tokenizer, model };
}

export async function generateAnswer(model, tokenizer, processor, prompt, canvas, mode) {
    if (!prompt || !canvas) {
        throw new Error('Missing prompt or canvas');
    }

    if (mode === 'Client') {
        if (!model || !tokenizer || !processor) {
            throw new Error('Model not loaded');
        }

        const text = `<image>\n\nQuestion: ${prompt}\n\nAnswer:`;
        const textInputs = tokenizer(text);

        const rawImage = await RawImage.fromCanvas(canvas);
        const visionInputs = await processor(rawImage);

        const output = await model.generate({
            ...textInputs,
            ...visionInputs,
            do_sample: false,
            max_new_tokens: 64,
        });

        const decoded = tokenizer.batch_decode(output, { skip_special_tokens: false });
        return decoded[0];
    } 
    else if (mode === 'Hybrid') {
        const formData = new FormData();
        formData.append('image', await new Promise(resolve => canvas.toBlob(resolve)));
        formData.append('prompt', prompt);

        try {
            const response = await fetch('http://localhost:8000/api/analyze', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(await response.text() || 'Server request error');
            }

            const data = await response.json();
            return data.answer;
        } catch (error) {
            console.error('Server request error:', error);
            throw error;
        }
    } else {
        throw new Error('Unknown operation mode');
    }
}

export async function deleteMoondreamModel(){
    const cache = await caches.open('transformers-cache');
    const keys = await cache.keys();
    keys.forEach(request => cache.delete(request));
}