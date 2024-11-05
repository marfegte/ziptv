const fileInput = document.getElementById('fileInput');
        const channelList = document.getElementById('channelList');
        const videoPlayer = document.getElementById('videoPlayer');
        const errorMessage = document.getElementById('errorMessage');
        const qualityInfo = document.getElementById('qualityInfo');
        let selectedChannel = null;
        let hls = null;

        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target.result;
                    if (file.name.endsWith('.m3u') || file.name.endsWith('.m3u8')) {
                        parseM3U(content);
                    } else {
                        // Para arquivos MP4 e MKV, adicione-os diretamente à lista
                        addChannel(file.name, URL.createObjectURL(file));
                    }
                };
                reader.readAsText(file);
            }
        });

        function parseM3U(content) {
            const lines = content.split('\n');
            let currentChannel = {};
            
            lines.forEach(line => {
                line = line.trim();
                if (line.startsWith('#EXTINF:')) {
                    const titleMatch = line.match(/,(.+)$/);
                    if (titleMatch) {
                        currentChannel.title = titleMatch[1].trim();
                    } else {
                        // Se não encontrar o título após a vírgula, use todo o conteúdo após #EXTINF:
                        currentChannel.title = line.split(':')[1].split(',').pop().trim();
                    }
                } else if (line !== '' && !line.startsWith('#')) {
                    currentChannel.url = line;
                    if (currentChannel.title && currentChannel.url) {
                        addChannel(currentChannel.title, currentChannel.url);
                        currentChannel = {};
                    }
                }
            });
        }

        function addChannel(title, url) {
            const channelElement = document.createElement('div');
            channelElement.className = 'channel-item';
            channelElement.textContent = title || "Canal sem nome";
            channelElement.onclick = () => {
                selectChannel(channelElement);
                playChannel(url, title);
            };
            channelList.appendChild(channelElement);
        }

        function selectChannel(channelElement) {
            if (selectedChannel) {
                selectedChannel.classList.remove('selected');
            }
            channelElement.classList.add('selected');
            selectedChannel = channelElement;
        }

        function playChannel(url, title) {
            errorMessage.textContent = ''; // Limpa mensagens de erro anteriores
            qualityInfo.textContent = ''; // Limpa informações de qualidade anteriores
            
            if (Hls.isSupported()) {
                if (hls) {
                    hls.destroy();
                }
                hls = new Hls({
                    capLevelToPlayerSize: true,
                    maxLoadingDelay: 4,
                    maxBufferLength: 30,
                    maxMaxBufferLength: 600
                });
                hls.loadSource(url);
                hls.attachMedia(videoPlayer);
                hls.on(Hls.Events.MANIFEST_PARSED, function(event, data) {
                    videoPlayer.play();
                    
                    // Encontrar o melhor nível de qualidade (720p ou 1080p)
                    let bestLevel = -1;
                    let bestHeight = 0;
                    data.levels.forEach((level, index) => {
                        if (level.height >= 720 && level.height <= 1080 && level.height > bestHeight) {
                            bestHeight = level.height;
                            bestLevel = index;
                        }
                    });
                    
                    if (bestLevel !== -1) {
                        hls.currentLevel = bestLevel;
                        qualityInfo.textContent = `Qualidade selecionada: ${bestHeight}p`;
                    } else {
                        hls.currentLevel = -1; // Auto quality
                        qualityInfo.textContent = 'Qualidade: Automática';
                    }
                });
                hls.on(Hls.Events.LEVEL_SWITCHED, function(event, data) {
                    const level = hls.levels[data.level];
                    qualityInfo.textContent = `Qualidade atual: ${level.height}p`;
                });
                hls.on(Hls.Events.ERROR, function (event, data) {
                    if (data.fatal) {
                        switch(data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                errorMessage.textContent = "Erro de rede ao carregar o vídeo. Tente novamente mais tarde.";
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                errorMessage.textContent = "Erro de mídia. O formato pode não ser suportado.";
                                break;
                            default:
                                errorMessage.textContent = "Ocorreu um erro ao reproduzir o vídeo.";
                                break;
                        }
                    }
                });
            } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
                videoPlayer.src = url;
                videoPlayer.addEventListener('loadedmetadata', function() {
                    videoPlayer.play();
                });
                videoPlayer.addEventListener('error', function() {
                    errorMessage.textContent = "Erro ao carregar o vídeo. Verifique se o formato é suportado.";
                });
            } else {
                errorMessage.textContent = "Seu navegador não suporta a reprodução deste tipo de mídia.";
            }
            // Atualiza o título do vídeo sendo reproduzido
            document.title = `Reproduzindo: ${title}`;
        }