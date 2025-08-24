import React, { useState, useEffect, useRef } from 'react';

const AdminPage: React.FC = () => {
    const [images, setImages] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const inputFileRef = useRef<HTMLInputElement | null>(null);

    const fetchImages = async () => {
        try {
            const response = await fetch('/api/portfolio');
            if (!response.ok) throw new Error('Failed to fetch images');
            const data = await response.json();
            setImages(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchImages();
    }, []);

    const handleUpload = async () => {
        if (!inputFileRef.current?.files) {
            return;
        }

        const file = inputFileRef.current.files[0];
        if (!file) {
            setError('Por favor, selecione um arquivo.');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            const response = await fetch(`/api/portfolio`, {
                method: 'POST',
                headers: { 'x-vercel-filename': file.name },
                body: file,
            });

            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || 'Falha no upload.');
            }

            const newBlob = await response.json();
            setImages(prevImages => [newBlob.url, ...prevImages]); // Adiciona no início
            if(inputFileRef.current) inputFileRef.current.value = ""; // Limpa o input
        } catch (err: any) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };
    
    const handleDelete = async (url: string) => {
        if (!window.confirm("Tem certeza que deseja deletar esta imagem?")) return;
        
        try {
            const response = await fetch(`/api/portfolio`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });

            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || 'Falha ao deletar.');
            }
            
            setImages(prevImages => prevImages.filter(imgUrl => imgUrl !== url));

        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="page">
            <header className="header">
                <h2>Gerenciar Portfólio</h2>
                <p>Adicione ou remova fotos do seu trabalho.</p>
            </header>

            <div className="admin-upload-section">
                <h3>Adicionar Nova Foto</h3>
                <input type="file" ref={inputFileRef} accept="image/*" disabled={uploading} />
                <button onClick={handleUpload} disabled={uploading} className="nav-button">
                    {uploading ? 'Enviando...' : 'Fazer Upload'}
                </button>
            </div>
            
             {error && <p className="form-error" style={{textAlign: 'center'}}>{error}</p>}

            <div className="admin-gallery">
                <h3>Portfólio Atual</h3>
                {isLoading && <p>Carregando imagens...</p>}
                {!isLoading && images.length === 0 && <p>Nenhuma imagem no portfólio ainda.</p>}
                
                <div className="portfolio-gallery" style={{marginTop: '1rem'}}>
                    {images.map(url => (
                        <div key={url} className="admin-gallery-item">
                            <img src={url} alt="Portfolio item" />
                            <button onClick={() => handleDelete(url)} className="delete-button">&times;</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminPage;
